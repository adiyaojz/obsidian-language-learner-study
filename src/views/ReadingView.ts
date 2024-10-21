import { Menu, TextFileView, WorkspaceLeaf, Notice } from "obsidian";
import { App as VueApp, createApp } from "vue";

import LanguageLearner from "@/plugin";
import ReadingArea from "ReadingArea.vue";
import { t } from "@/lang/helper";

// 定义阅读视图的类型名称常量
export const READING_VIEW_TYPE: string = "langr-reading";
// 定义阅读视图的图标常量
export const READING_ICON: string = "highlight-glyph";

// 定义阅读视图类
export class ReadingView extends TextFileView {
    // 插件实例
    plugin: LanguageLearner;
    // 存储文本内容
    text: string;
    // 存储操作按钮的对象
    actionButtons: Record<string, HTMLElement> = {};
    // Vue 应用实例
    vueapp: VueApp;
    // 标记是否是首次初始化
    firstInit: boolean;
    // 上次的位置
    lastPos: number;

    // 构造函数，接收一个工作区叶子对象和插件实例作为参数，并初始化类的属性
    constructor(leaf: WorkspaceLeaf, plugin: LanguageLearner) {
        super(leaf);
        this.plugin = plugin;
        this.firstInit = true;
    }

    // 获取视图的图标
    getIcon() {
        return READING_ICON;
    }

    // 获取视图的数据，这里返回文本内容
    getViewData(): string {
        return this.data;
    }

    // 设置视图的数据，如果是首次初始化，进行一些额外的操作
    async setViewData(data: string, clear?: boolean) {
        this.text = data;

        if (this.firstInit) {
            // 从前端管理器获取上次的位置信息
            let lastPos = await this.plugin.frontManager.getFrontMatter(
                this.file,
                "langr-pos"
            );
            this.lastPos = parseInt(lastPos);

            // 创建 Vue 应用实例并挂载到内容元素上
            this.vueapp = createApp(ReadingArea);
            this.vueapp.config.globalProperties.plugin = this.plugin;
            this.vueapp.config.globalProperties.view = this;
            this.vueapp.mount(this.contentEl);

            this.firstInit = false;
        }
        // this.plugin.setMarkdownView(this.leaf, false)
    }

    // 获取视图的类型名称
    getViewType(): string {
        return READING_VIEW_TYPE;
    }

    // 在窗格菜单中添加自定义菜单项
    onPaneMenu(menu: Menu): void {
        menu.addItem((item) => {
            item.setTitle(t("Return to Markdown"))
                .setIcon("document")
                .onClick(() => {
                    this.backToMarkdown();
                });
        }).addSeparator();
        super.onPaneMenu(menu, "");
    }

    // 返回 Markdown 视图的方法
    backToMarkdown(): void {
        this.plugin.setMarkdownView(this.leaf);
    }

    // 保存单词的方法
    async saveWords() {
        // 如果读取单词内容为空，则返回
        if ((await this.readContent("words")) === null) {
            return;
        }

        // 读取文章内容并获取单词和短语信息
        let data = await this.readContent("article");
        let exprs =
            (await this.plugin.parser.getWordsPhrases(data))
                .map((w) => `- [[${w.expression}]] : ${w.meaning}`)
                .join("\n") + "\n\n";

        // 写入单词内容
        await this.writeContent("words", exprs);
    }

    // 将文本内容按照特定标记进行分割
    divide(lines: string[]) {
        // 创建一个二维数组，用于存储标记名称和对应在 lines 中的索引位置
        let positions = [] as [string, number][];
        // 将特定标记和它们在 lines 中的索引位置添加到 positions 数组中
        positions.push(
            ["article", lines.indexOf("^article")],
            ["words", lines.indexOf("^words")],
            ["notes", lines.indexOf("^notes")]
        );
        // 按照索引位置从小到大对 positions 数组进行排序
        positions.sort((a, b) => a[1] - b[1]);
        // 过滤掉索引位置为 -1 的项，即不存在对应标记的项
        positions = positions.filter((v) => v[1] !== -1);
        // 添加一个表示文件结束的标记和 lines 的长度到 positions 数组中
        positions.push(["eof", lines.length]);

        // 创建一个对象，用于存储每个标记对应的起始和结束索引位置
        let segments = {} as { [K in string]: { start: number; end: number } };
        // 遍历 positions 数组，除了最后一个元素
        for (let i = 0; i < positions.length - 1; i++) {
            // 设置每个标记对应的起始索引为当前标记的索引位置加一，结束索引为下一个标记的索引位置
            segments[`${positions[i][0]}`] = {
                start: positions[i][1] + 1,
                end: positions[i + 1][1],
            };
        }
        // 返回分割后的 segments 对象
        return segments;
    }

    // 读取特定类型的内容，如果指定创建则在不存在时创建相应部分
    async readContent(type: string, create: boolean = false): Promise<string> {
        let oldText = await this.plugin.app.vault.read(this.file); // 从Obsidian的仓库中异步读取当前文件的内容
        let lines = oldText.split("\n"); // 将文件内容按行分割成数组
        let seg = this.divide(lines); // 使用divide方法对行进行分区，以找到特定类型内容的位置
        if (!seg[type]) {
            // 如果没有找到指定类型的内容
            if (create) {
                // 如果create参数为true，则创建该部分
                this.plugin.app.vault.modify(
                    // 修改文件内容
                    this.file,
                    oldText + `\n^${type}\n\n` // 在文件末尾添加新的部分标记和空行
                );
                return ""; // 返回空字符串，因为新创建的部分是空的
            }
            return null; // 如果create为false且内容不存在，则返回null
        }
        return lines.slice(seg[type].start, seg[type].end).join("\n"); // 返回指定类型内容的字符串
    }

    // 写入特定类型的内容
    async writeContent(type: string, content: string): Promise<void> {
        let oldText = await this.plugin.app.vault.read(this.file); // 从Obsidian的仓库中异步读取当前文件的内容
        let lines = oldText.split("\n"); // 将文件内容按行分割成数组
        let seg = this.divide(lines); // 使用divide方法对行进行分区，以找到特定类型内容的位置
        if (!seg[type]) {
            // 如果没有找到指定类型的内容
            return; // 如果内容不存在，则不进行任何操作
        }
        let newText = // 构建新的文件内容字符串
            lines.slice(0, seg[type].start).join("\n") + // 从文件开始到指定类型内容前的部分
            "\n" + // 添加一个新行
            content.trim() + // 添加要写入的内容，并去除两端空白
            "\n\n" + // 添加两个新行作为分隔
            lines.slice(seg[type].end, lines.length).join("\n"); // 从指定类型内容后到文件结束的部分
        this.plugin.app.vault.modify(this.file, newText); // 修改文件内容，写入新的部分
    }
    // 清空方法，目前为空实现
    clear(): void {}

    // 刷新阅读页面中单词的状态，当新词面板提交后触发
    // 定义一个名为 refresh 的函数，接收一个可选的 CustomEvent 类型的参数 evt

    refresh = (evt?: CustomEvent) => {
        // 如果有传入的事件对象，从其 detail 属性中获取表达式并转换为小写
        let expression: string = evt?.detail.expression.toLowerCase();
        // 从事件对象的 detail 属性中获取类型
        let type: string = evt?.detail.type;
        // 从事件对象的 detail 属性中获取状态
        let status: number = evt?.detail.status;
        // 定义一个状态映射数组
        const statusMap = [
            "ignore",
            "learning",
            "familiar",
            "known",
            "learned",
        ];

        // 如果类型是 "WORD"
        if (type === "WORD") {
            // 获取所有带有 ".word" 类名的元素
            let wordEls = this.contentEl.querySelectorAll(".word");
            // 如果没有找到这样的元素，直接返回
            if (wordEls.length === 0) {
                return;
            }
            // 遍历这些元素
            wordEls.forEach((el) => {
                // 如果元素的文本内容（转换为小写后）与传入的表达式相同
                if (el.textContent.toLowerCase() === expression) {
                    // 设置元素的类名为 "word" 加上对应的状态
                    el.className = `word ${statusMap[status]}`;
                }
            });
        } else if (type === "PHRASE") {
            // 获取所有带有 ".phrase" 类名的元素
            let phraseEls = this.contentEl.querySelectorAll(".phrase");
            let isExist = false;
            // 如果有这样的元素
            if (phraseEls.length > 0) {
                // 遍历这些元素
                phraseEls.forEach((el) => {
                    // 如果元素的文本内容（转换为小写后）与传入的表达式相同
                    if (el.textContent.toLowerCase() === expression) {
                        // 设置元素的类名为 "phrase" 加上对应的状态
                        el.className = `phrase ${statusMap[status]}`;
                        // 设置标志为存在匹配的词组
                        isExist = true;
                    }
                });
            }

            // 调用 removeSelect 方法
            this.removeSelect();
            // 如果存在匹配的词组，直接返回
            if (isExist) {
                return;
            }

            // 将词组拆分成单词和空格，存储在 words 数组中
            let words: string[] = [];
            expression.split(" ").forEach((w) => {
                if (w !== "") {
                    words.push(w, " ");
                }
            });
            words.pop();

            // 定义一个函数 isMatch，用于判断从一个起始元素开始是否能匹配一系列单词
            let isMatch = (startEl: Element, words: string[]) => {
                let el = startEl as any;
                let container: Element[] = [];
                for (let word of words) {
                    // 如果元素不存在或者文本内容不匹配当前单词
                    if (!el || el.textContent.toLowerCase() !== word) {
                        return null;
                    }
                    // 将元素添加到容器中
                    container.push(el);
                    // 获取下一个兄弟元素
                    el = el.nextSibling;
                }

                // 返回匹配的元素容器
                return container;
            };

            // 获取所有带有 ".stns" 类名的元素
            let sentencesEls = this.containerEl.querySelectorAll(".stns");
            // 遍历这些元素
            sentencesEls.forEach((senEl) => {
                let children = senEl.children;
                let idx = -1;
                while (idx++ < children.length) {
                    let container;
                    // 检查当前位置的元素是否与传入的单词序列匹配
                    if ((container = isMatch(children[idx], words))) {
                        // 创建一个带有特定类名的 span 元素
                        let phraseEl = createSpan({
                            cls: `phrase ${statusMap[status]}`,
                        });
                        // 将 span 元素插入到当前元素之前
                        senEl.insertBefore(phraseEl, children[idx]);
                        // 将匹配的元素从原来的位置移除并添加到 span 元素中
                        container.forEach((el) => {
                            el.remove();
                            phraseEl.appendChild(el);
                        });
                        // 更新索引，跳过已经处理的单词数量
                        idx += words.length - 1;
                    }
                }
            });
        }
    };

    // 在选择的元素周围包裹一个带有特定类名的 span 元素
    wrapSelect(elStart: HTMLElement, elEnd: HTMLElement) {
        this.removeSelect();
        if (
            !elStart.matchParent(".stns") ||
            !elEnd.matchParent(".stns") ||
            elStart.parentElement !== elEnd.parentElement
        ) {
            return null;
        }
        let parent = elStart.parentNode;
        let selectSpan = document.body.createSpan({ cls: "select" });
        parent.insertBefore(selectSpan, elStart);
        for (let el: Node = elStart; el !== elEnd; ) {
            let next = el.nextSibling;
            selectSpan.appendChild(el);
            el = next;
        }
        selectSpan.appendChild(elEnd);
        return selectSpan;
    }

    // 移除所有带有 select 类名的元素，并将其内部的元素放回原位
    removeSelect() {
        //把span.select里面的东西拿出来
        let selects = this.contentEl.querySelectorAll("span.select");
        selects.forEach((el: HTMLElement) => {
            let parent = el.parentElement;
            let children: Node[] = [];
            el.childNodes.forEach((child) => {
                children.push(child);
            });
            for (let c of children) {
                parent.insertBefore(c, el);
            }
            el.remove();
        });
    }

    // 初始化头部按钮
    initHeaderButtons() {
        this.addAction("book", t("Return to Markdown"), () => {
            this.backToMarkdown();
        });
    }

    // 当视图打开时的处理逻辑
    async onOpen() {
        // 添加一个事件监听器，当触发 "obsidian-langr-refresh" 事件时，调用 this.refresh 函数
        addEventListener("obsidian-langr-refresh", this.refresh);
        // 调用 initHeaderButtons 方法进行一些初始化操作（可能是初始化头部按钮等）
        this.initHeaderButtons();
    
        // const contentEl = this.contentEl.createEl("div", {
        //     cls: "langr-reading",
        // })
        // 这部分被注释掉了，可能是创建一个带有特定类名的 div 元素，但在当前代码中未被使用
    }

// 当视图关闭时的处理逻辑
async onClose() {
    // 移除之前添加的 "obsidian-langr-refresh" 事件监听器，不再调用 this.refresh 函数
    removeEventListener("obsidian-langr-refresh", this.refresh);
    // 卸载 Vue 应用实例，清理相关资源
    this.vueapp.unmount();
    // 调用 saveWords 方法，可能是保存单词等相关数据
    this.saveWords();
}
}
