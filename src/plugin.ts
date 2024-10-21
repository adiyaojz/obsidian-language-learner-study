import {
    Notice,
    Plugin,
    Menu,
    WorkspaceLeaf,
    ViewState,
    MarkdownView,
    Editor,
    TFile,
    normalizePath,
    Platform,
} from "obsidian";
import { around } from "monkey-around";
import { createApp, App as VueApp } from "vue";

import {
    SearchPanelView,
    SEARCH_ICON,
    SEARCH_PANEL_VIEW,
} from "./views/SearchPanelView";
import {
    READING_VIEW_TYPE,
    READING_ICON,
    ReadingView,
} from "./views/ReadingView";
import {
    LearnPanelView,
    LEARN_ICON,
    LEARN_PANEL_VIEW,
} from "./views/LearnPanelView";
import { StatView, STAT_ICON, STAT_VIEW_TYPE } from "./views/StatView";
import {
    DataPanelView,
    DATA_ICON,
    DATA_PANEL_VIEW,
} from "./views/DataPanelView";
// import { PDFView, PDF_FILE_EXTENSION, VIEW_TYPE_PDF } from "./views/PDFView";

import { t } from "./lang/helper";
import DbProvider from "./db/base";
import { LocalDb } from "./db/local_db";
import { TextParser } from "./views/parser";
import { FrontMatterManager } from "./utils/frontmatter";
import ExpressionInfo from "./db/idb"
import { DEFAULT_SETTINGS, MyPluginSettings, SettingTab } from "./settings";
import store from "./store";
import { playAudio } from "./utils/helpers";
import type { Position } from "./constant";
import { InputModal } from "./modals";
import { FileDb } from "./db/file_db";
import Global from "./views/Global.vue";

export const FRONT_MATTER_KEY: string = "langr";
// 插件的常量和设置
const statusMap = [
    t("Ignore"),
    t("Learning"),
    t("Familiar"),
    t("Known"),
    t("Learned"),
];




export default class LanguageLearner extends Plugin {
    constants: { basePath: string; platform: "mobile" | "desktop" };
    settings: MyPluginSettings;
    appEl: HTMLElement; // 插件的根 HTML 元素
    vueApp: VueApp; // Vue 应用实例
    db: DbProvider; // 数据库提供者
    parser: TextParser; // 文本解析器
    markdownButtons: Record<string, HTMLElement> = {}; // Markdown 按钮
    frontManager: FrontMatterManager; // 前置事务管理器
    store: typeof store = store; // 状态存储

    async onload() {
        // 插件加载时执行的操作
        await this.loadSettings(); // 加载插件设置
        this.addSettingTab(new SettingTab(this.app, this)); // 添加设置标签页

        this.registerConstants(); // 注册常量
        // 打开数据库 取消网络服务
        // this.db = this.settings.use_server
        //     ? new WebDb(
        //           this.settings.host,
        //           this.settings.port,
        //           this.settings.use_https,
        //           this.settings.api_key
        //       )
        //     : new LocalDb(this);

        this.db = new LocalDb(this);
        await this.db.open();

        // 设置解析器
        this.parser = new TextParser(this);
        this.frontManager = new FrontMatterManager(this.app);

        // /打开内置服务器
        // this.server = this.settings.self_server
        //     ? new Server(this, this.settings.self_port)
        //     : null;
        // await this.server?.start();

        // test
        // this.addCommand({
        // 	id: "langr-test",
        // 	name: "Test for langr",
        // 	callback: () => new Notice("hello!")
        // })

        // await this.replacePDF();

        this.initStore(); // 初始化状态存储
        this.addCommands(); // 注册命令
        this.registerCustomViews(); // 注册自定义视图
        this.registerReadingToggle(); // 注册阅读切换
        this.registerContextMenu(); // 注册上下文菜单
        this.registerLeftClick(); // 注册左键点击事件
        this.registerMouseup(); // 注册鼠标释放事件
        this.registerEvent(
            // 注册事件
            this.app.workspace.on("css-change", () => {
                // 当 CSS 发生变化时
                store.dark = document.body.hasClass("theme-dark"); // 更新暗黑模式状态
                store.themeChange = !store.themeChange; // 切换主题变化状态
            })
        );
        // 创建全局app用于各种浮动元素
        this.appEl = document.body.createDiv({ cls: "langr-app" }); // 创建插件的根元素
        this.vueApp = createApp(Global); // 创建 Vue 应用
        this.vueApp.config.globalProperties.plugin = this; // 设置全局属性
        this.vueApp.mount(this.appEl); // 挂载 Vue 应用
    }
    async onunload() {
        // 插件卸载时执行的操作
        this.app.workspace.detachLeavesOfType(SEARCH_PANEL_VIEW); // 卸载搜索面板视图
        this.app.workspace.detachLeavesOfType(LEARN_PANEL_VIEW); // 卸载学习面板视图
        this.app.workspace.detachLeavesOfType(DATA_PANEL_VIEW); // 卸载数据面板视图
        this.app.workspace.detachLeavesOfType(STAT_VIEW_TYPE); // 卸载统计视图
        this.app.workspace.detachLeavesOfType(READING_VIEW_TYPE); // 卸载阅读视图
        this.db.close(); // 关闭数据库
        // if (await app.vault.adapter.exists(".obsidian/plugins/obsidian-language-learner/pdf/web/viewer.html")) {
        //     this.registerExtensions([PDF_FILE_EXTENSION], "pdf");
        // }

        this.vueApp.unmount(); // 卸载 Vue 应用
        this.appEl.remove(); // 移除插件的根元素
        this.appEl = null; // 清空根元素引用
    }

    registerConstants() {
        // 注册常量
        this.constants = {
            basePath: normalizePath((this.app.vault.adapter as any).basePath), // 规范化基础路径
            platform: Platform.isMobile ? "mobile" : "desktop", // 判断平台是移动设备还是桌面
        };
    }

    // async replacePDF() {
    //     if (await app.vault.adapter.exists(
    //         ".obsidian/plugins/obsidian-language-learner/pdf/web/viewer.html"
    //     )) {
    //         this.registerView(VIEW_TYPE_PDF, (leaf) => {
    //             return new PDFView(leaf);
    //         });

    //         (this.app as any).viewRegistry.unregisterExtensions([
    //             PDF_FILE_EXTENSION,
    //         ]);
    //         this.registerExtensions([PDF_FILE_EXTENSION], VIEW_TYPE_PDF);

    //         this.registerDomEvent(window, "message", (evt) => {
    //             if (evt.data.type === "search") {
    //                 // if (evt.data.funckey || this.store.searchPinned)
    //                 this.queryWord(evt.data.selection);
    //             }
    //         });
    //     }
    // }

    initStore() {
        // 初始化store中的dark属性，根据当前文档体是否有theme-dark类来判断是否为暗黑模式
        this.store.dark = document.body.hasClass("theme-dark");
        // 初始化themeChange属性，用于追踪主题是否发生变化，初始值为false
        this.store.themeChange = false;
        // 从插件设置中读取字体大小，并更新store中的fontSize属性
        this.store.fontSize = this.settings.font_size;
        // 从插件设置中读取字体家族，并更新store中的fontFamily属性
        this.store.fontFamily = this.settings.font_family;
        // 从插件设置中读取行高，并更新store中的lineHeight属性
        this.store.lineHeight = this.settings.line_height;
        // 从插件设置中读取是否启用弹出搜索，并更新store中的popupSearch属性
        this.store.popupSearch = this.settings.popup_search;
        // 初始化searchPinned属性，用于追踪搜索面板是否被固定，初始值为false
        this.store.searchPinned = true;
        // 初始化dictsChange属性，用于追踪字典设置是否发生变化，初始值为false
        this.store.dictsChange = true;
        // 从插件设置中读取字典面板的高度，并更新store中的dictHeight属性
        this.store.dictHeight = this.settings.dict_height;
    }

    addCommands() {
        // 注册刷新单词数据库命令
        this.addCommand({
            id: "langr-refresh-word-database",
            name: t("Refresh Word Database"),
            callback: this.refreshWordDb,
        });

        // 注册刷新复习数据库命令
        this.addCommand({
            id: "langr-refresh-review-database",
            name: t("Refresh Review Database"),
            callback: this.refreshReviewDb,
        });

        // 注册查词命令
        this.addCommand({
            id: "langr-search-word-select",
            name: t("Translate Select"),
            callback: () => {
                let selection = window.getSelection().toString().trim();
                this.queryWord(selection);
            },
        });
        this.addCommand({
            id: "langr-search-word-input",
            name: t("Translate Input"),
            callback: () => {
                const modal = new InputModal(this.app, (text) => {
                    this.queryWord(text);
                });
                modal.open();
            },
        });
    }

    registerCustomViews() {
        // 注册查词面板视图
        this.registerView(
            SEARCH_PANEL_VIEW,
            (leaf) => new SearchPanelView(leaf, this)
        );
        this.addRibbonIcon(SEARCH_ICON, t("Open word search panel"), (evt) => {
            this.activateView(SEARCH_PANEL_VIEW, "left");
        });

        // 注册新词面板视图
        this.registerView(
            LEARN_PANEL_VIEW,
            (leaf) => new LearnPanelView(leaf, this)
        );
        this.addRibbonIcon(LEARN_ICON, t("Open new word panel"), (evt) => {
            this.activateView(LEARN_PANEL_VIEW, "right");
        });

        // 注册阅读视图
        this.registerView(
            READING_VIEW_TYPE,
            (leaf) => new ReadingView(leaf, this)
        );

        //注册统计视图
        this.registerView(STAT_VIEW_TYPE, (leaf) => new StatView(leaf, this));
        this.addRibbonIcon(STAT_ICON, t("Open statistics"), async (evt) => {
            this.activateView(STAT_VIEW_TYPE, "right");
        });

        //注册单词列表视图
        this.registerView(
            DATA_PANEL_VIEW,
            (leaf) => new DataPanelView(leaf, this)
        );
        this.addRibbonIcon(DATA_ICON, t("Data Panel"), async (evt) => {
            this.activateView(DATA_PANEL_VIEW, "tab");
        });
    }

    async setMarkdownView(leaf: WorkspaceLeaf, focus: boolean = true) {
        // 异步方法，用于设置指定工作区叶节点的视图状态为 Markdown 视图
        await leaf.setViewState(
            // 调用工作区叶节点的 setViewState 方法来更新视图状态
            {
                type: "markdown", // 设置视图类型为 "markdown"
                state: leaf.view.getState(), // 获取当前叶节点视图的状态
                //popstate: true, // 这行代码被注释掉了，如果启用，会在浏览器的历史记录中添加一个状态
            } as ViewState, // 将对象类型断言为 ViewState，以匹配 setViewState 方法的参数类型
            { focus } // 设置第二个参数的对象，其中包含 focus 属性，决定是否将焦点设置到新视图
        );
    }

    async setReadingView(leaf: WorkspaceLeaf) {
        // 异步方法，用于设置指定工作区叶节点的视图状态为阅读视图
        await leaf.setViewState({
            type: READING_VIEW_TYPE, // 设置视图类型为预定义的阅读视图类型
            state: leaf.view.getState(), // 获取当前叶节点视图的状态
            //popstate: true, // 这行代码被注释掉了，如果启用，会在浏览器的历史记录中添加一个状态
        } as ViewState); // 将对象类型断言为 ViewState，以匹配 setViewState 方法的参数类型
    }

    async refreshTextDB() {
        // 异步方法，用于刷新文本数据库
        await this.refreshWordDb(); // 刷新单词数据库
        await this.refreshReviewDb(); // 刷新复习数据库
        await this.refreshIgnoreDB(); //刷新无视数据库
        (this.app as any).commands.executeCommandById(
            "various-complements:reload-custom-dictionaries"
        ); // 执行命令以重新加载自定义字典
    }

    refreshWordDb = async () => {
        // 检查是否启用了单词数据库功能
        if (!this.settings.use_fileDB) {
            return;
        }
        // 如果路径为空，则默认在根目录生成"WordDB.md"文件
        if (!this.settings.word_database) {
            this.settings.word_database = "data/WordDB.md"; // 设置默认文件名
        }
        /*--------old
        // 从Obsidian的仓库中获取单词数据库文件
        let dataBase = this.app.vault.getAbstractFileByPath(
            this.settings.word_database
        );
        // 如果文件不存在或不是一个叶子节点（即目录），则显示错误通知
        if (!dataBase || dataBase.hasOwnProperty("children")) {
            new Notice("Invalid refresh database path");
            return;
        }
        */
        /*---------------------------------------------------*/
        // 从Obsidian的仓库中获取单词数据库文件
        let dataBase = this.app.vault.getAbstractFileByPath(
            this.settings.word_database
        );

        // 如果文件不存在，则创建对应路径的文件
        if (!dataBase) {
            // 分割路径以获取目录和文件名
            let pathParts = this.settings.word_database.split("/");
            let dirPath = pathParts.slice(0, -1).join("/"); // 获取目录路径
            let fileName = pathParts[pathParts.length - 1]; // 获取文件名

            // 确保目录存在，如果不存在则创建目录
            if (dirPath && !this.app.vault.getAbstractFileByPath(dirPath)) {
                this.app.vault.createFolder(dirPath); // 创建目录

                // 创建文件
                try {
                    await this.app.vault.create(
                        this.settings.word_database,
                        fileName
                    );
                } catch (err) {
                    if (err.message.includes("File already exists")) {
                        this.app.vault.adapter.write(
                            normalizePath(this.settings.word_database),
                            fileName
                        );
                    }
                }
            }
            // 如果文件是一个目录（而不是文件），则显示错误通知
            // if (dataBase && dataBase.hasOwnProperty("children")) {
            //     new Notice("Invalid refresh database path");
            //     return;
            // }
            dataBase = this.app.vault.getAbstractFileByPath(
                this.settings.word_database
            );
        }
        /*----------------------------------------------*/

        // 获取所有非忽略状态的单词简略信息
        let words = await this.db.getAllExpressionSimple(false);

        // 初始化一个数组来分类单词，每个状态一个数组
        let classified: number[][] = Array(5)
            .fill(0)
            .map((_) => []);
        // 将单词根据状态分类
        words.forEach((word, i) => {
            classified[word.status].push(i);
        });

        // 状态名称映射，用于显示
        const statusMap = [
            t("Ignore"),
            t("Learning"),
            t("Familiar"),
            t("Known"),
            t("Learned"),
        ];

        // 设置列分隔符
        let del = this.settings.col_delimiter;

        // 正向查询：表达式到意义
        let classified_texts = classified.map((w, idx) => {
            return (
                `#### ${statusMap[idx]}\n` +
                w
                    .map(
                        (i) =>
                            `${words[i].expression}  ${del}  ${words[i].meaning}`
                    )
                    .join("\n") +
                "\n"
            );
        });
        // 移除忽略状态的分类
        classified_texts.shift();
        let word2Meaning = classified_texts.join("\n");

        // 反向查询：意义到表达式
        let meaning2Word = classified
            .flat()
            .map((i) => `${words[i].meaning}  ${del}  ${words[i].expression}`)
            .join("\n");

        // 组合正向和反向查询的文本
        let text = word2Meaning + "\n\n" + "#### 反向查询\n" + meaning2Word;
        // 将文件对象转换为TFile类型
        let db = dataBase as TFile;
        // 修改文件内容
        this.app.vault.modify(db, text);
    };

    refreshReviewDb = async () => {
        if (!this.settings.use_fileDB) {
            return;
        }
        // 检查是否设置了复习数据库路径
        if (!this.settings.review_database) {
            this.settings.review_database = "data/ReviewDB.md";
        }

        // 从Obsidian的仓库中获取复习数据库文件
        let dataBase = this.app.vault.getAbstractFileByPath(
            this.settings.review_database
        );

        // 如果文件不存在或是一个目录（而不是文件），则显示错误通知并退出函数
        if (!dataBase) {
            // 分割路径以获取目录和文件名

            let pathParts = this.settings.review_database.split("/");
            let dirPath = pathParts.slice(0, -1).join("/"); // 获取目录路径
            let fileName = pathParts[pathParts.length - 1]; // 获取文件名

            // 确保目录存在，如果不存在则创建目录
            if (dirPath && !this.app.vault.getAbstractFileByPath(dirPath)) {
                this.app.vault.createFolder(dirPath); // 创建目录
            }

            // 创建文件
            try {
                await this.app.vault.create(
                    this.settings.review_database,
                    fileName
                );
            } catch (err) {
                if (err.message.includes("File already exists")) {
                    this.app.vault.adapter.write(
                        normalizePath(this.settings.review_database),
                        fileName
                    );
                }
            }
            dataBase = this.app.vault.getAbstractFileByPath(
                this.settings.review_database
            );
        }
        // 将获取的文件对象断言为TFile类型
        let db = dataBase as TFile;
        // 读取文件内容
        let text = await this.app.vault.read(db);
        // 创建一个空对象，用于存储旧的记录
        let oldRecord = {} as { [K in string]: string };
        // 使用正则表达式匹配旧的记录，并存储到oldRecord对象中
        text.match(/#word(\n.+)+\n(<!--SR.*?-->)/g)
            ?.map((v) => v.match(/#### (.+)[\s\S]+(<!--SR.*-->)/))
            ?.forEach((v) => {
                oldRecord[v[1]] = v[2];
            });

        // 从数据库中获取所有需要复习的表达式记录
        let data = await this.db.getExpressionAfter("1970-01-01T00:00:00Z");
        // 如果没有新数据，则退出函数
        if (data.length === 0) {
            return;
        }

        // 根据表达式对数据进行排序
        data.sort((a, b) => a.expression.localeCompare(b.expression));

        // 创建新的文本内容
        let newText =
            data
                .map((word) => {
                    // 创建笔记部分
                    // let notes =
                    //     word.notes.length === 0
                    //         ? ""
                    //         : "**Notes**:\n" +
                    //           word.notes.join("\n").trim() +
                    //           "\n";
                    // 创建例句部分
                    // let sentences =
                    //     word.sentences.length === 0
                    //         ? ""
                    //         : "**Sentences**:\n" +
                    //           word.sentences
                    //               .map((sen) => {
                    //                   return (
                    //                       `*${sen.text.trim()}*` +
                    //                       "\n" +
                    //                       (sen.trans
                    //                           ? sen.trans.trim() + "\n"
                    //                           : "") +
                    //                       (sen.origin ? sen.origin.trim() : "")
                    //                   );
                    //               })
                    //               .join("\n")
                    //               .trim() +
                    //           "\n";

                    // 返回格式化后的单词复习记录
                    return (
                        `#word\n` +
                        `#### ${word.expression}\n` +
                        `${this.settings.review_delimiter}\n` +
                        `${word.meaning}\n` +
                        // `${notes}` +
                        // `${sentences}` +
                        (oldRecord[word.expression]
                            ? oldRecord[word.expression] + "\n"
                            : "")
                    );
                })
                .join("\n") + "\n";

        // 在新文本内容前添加标题
        newText = "#flashcards\n\n" + newText;
        // 将新文本内容写入文件
        await this.app.vault.modify(db, newText);

        // 保存设置
        this.saveSettings();
    };

    refreshIgnoreDB = async () => {
        // 检查是否启用了忽略单词数据库功能
        if (!this.settings.use_fileDB) {
            return;
        }

        // 如果路径为空，则默认在根目录生成"IgnoreDB.md"文件
        if (!this.settings.ignore_database) {
            this.settings.ignore_database = "data/IgnoreDB.md"; // 设置默认文件名
        }

        // 从Obsidian的仓库中获取忽略单词数据库文件
        let ignoreDB = this.app.vault.getAbstractFileByPath(
            this.settings.ignore_database
        );

        // 如果文件不存在，则创建对应路径的文件
        if (!ignoreDB) {
            // 分割路径以获取目录和文件名
            let pathParts = this.settings.ignore_database.split("/");
            let dirPath = pathParts.slice(0, -1).join("/"); // 获取目录路径
            let fileName = pathParts[pathParts.length - 1]; // 获取文件名

            // 确保目录存在，如果不存在则创建目录
            if (dirPath && !this.app.vault.getAbstractFileByPath(dirPath)) {
                this.app.vault.createFolder(dirPath); // 创建目录
            }

            // 创建文件
            try {
                await this.app.vault.create(
                    this.settings.ignore_database,
                    fileName
                );
            } catch (err) {
                if (err.message.includes("File already exists")) {
                    this.app.vault.adapter.write(
                        normalizePath(this.settings.ignore_database),
                        fileName
                    );
                }
            }
            ignoreDB = this.app.vault.getAbstractFileByPath(
                this.settings.ignore_database
            );
        }

        // 获取所有忽略状态的单词简略信息
        let ignores = await this.db.getAllExpressionSimple(true);

        // 将忽略的单词数组转换为字符串，单词之间用换行符分隔
        let ignoreText = ignores.map((w) => w.expression).join("\n");

        // 将文件对象转换为TFile类型
        let db = ignoreDB as TFile;
        // 修改文件内容
        this.app.vault.modify(db, ignoreText);
    };

    // 在MardownView的扩展菜单加一个转为Reading模式的选项
    registerReadingToggle = () => {
        const pluginSelf = this;
        pluginSelf.register(
            around(MarkdownView.prototype, {
                onPaneMenu(next) {
                    return function (m: Menu) {
                        const file = this.file;
                        const cache = file.cache
                            ? pluginSelf.app.metadataCache.getFileCache(file)
                            : null;

                        if (
                            !file ||
                            !cache?.frontmatter ||
                            !cache?.frontmatter[FRONT_MATTER_KEY]
                        ) {
                            return next.call(this, m);
                        }

                        m.addItem((item) => {
                            item.setTitle(t("Open as Reading View"))
                                .setIcon(READING_ICON)
                                .onClick(() => {
                                    pluginSelf.setReadingView(this.leaf);
                                });
                        });

                        next.call(this, m);
                    };
                },
            })
        );

        // 增加标题栏切换阅读模式和mardown模式的按钮
        pluginSelf.register(
            around(WorkspaceLeaf.prototype, {
                setViewState(next) {
                    return function (
                        state: ViewState,
                        ...rest: any[]
                    ): Promise<void> {
                        return (
                            next.apply(this, [state, ...rest]) as Promise<void>
                        ).then(() => {
                            if (
                                state.type === "markdown" &&
                                state.state?.file
                            ) {
                                const cache =
                                    pluginSelf.app.metadataCache.getCache(
                                        state.state.file
                                    );
                                if (
                                    cache?.frontmatter &&
                                    cache.frontmatter[FRONT_MATTER_KEY]
                                ) {
                                    if (
                                        !pluginSelf.markdownButtons["reading"]
                                    ) {
                                        // 在软件初始化的时候，view上面可能没有 addAction 这个方法
                                        setTimeout(() => {
                                            pluginSelf.markdownButtons[
                                                "reading"
                                            ] = (
                                                this.view as MarkdownView
                                            ).addAction(
                                                "view",
                                                t("Open as Reading View"),
                                                () => {
                                                    pluginSelf.setReadingView(
                                                        this
                                                    );
                                                }
                                            );
                                            pluginSelf.markdownButtons[
                                                "reading"
                                            ].addClass("change-to-reading");
                                        });
                                    }
                                } else {
                                    // 在软件初始化的时候，view上面可能没有 actionsEl 这个字段
                                    (this.view.actionsEl as HTMLElement)
                                        ?.querySelectorAll(".change-to-reading")
                                        .forEach((el) => el.remove());
                                    // pluginSelf.markdownButtons["reading"]?.remove();
                                    pluginSelf.markdownButtons["reading"] =
                                        null;
                                }
                            } else {
                                pluginSelf.markdownButtons["reading"] = null;
                            }
                        });
                    };
                },
            })
        );
    };

    async queryWord(
        word: string,
        target?: HTMLElement,
        evtPosition?: Position
    ): Promise<void> {
        // 如果输入的单词为空，则直接返回
        if (!word) return;

        // 如果插件设置中禁用了弹出搜索，则激活侧边搜索面板
        if (!this.settings.popup_search) {
            await this.activateView(SEARCH_PANEL_VIEW, "left");
        }

        // 如果提供了目标元素（如点击的单词）并且是桌面应用，则激活右侧的学习面板
        if (target && Platform.isDesktopApp) {
            await this.activateView(LEARN_PANEL_VIEW, "right");
        }

        // 派发一个自定义事件，用于通知其他部分的插件或代码进行搜索操作
        dispatchEvent(
            new CustomEvent("obsidian-langr-search", {
                detail: { selection: word, target, evtPosition },
            })
        );

        // 如果设置了自动发音，则播放单词的发音
        if (this.settings.auto_pron) {
            let accent = this.settings.review_prons; // 获取发音类型设置
            let wordUrl =
                `http://dict.youdao.com/dictvoice?type=${accent}&audio=` +
                encodeURIComponent(word); // 构建有道词典的发音URL
            playAudio(wordUrl); // 播放发音音频
        }
    }

    // 管理所有的右键菜单
    registerContextMenu() {
        let addMemu = (mu: Menu, selection: string) => {
            mu.addItem((item) => {
                item.setTitle(t("Search word"))
                    .setIcon("info")
                    .onClick(async () => {
                        this.queryWord(selection);
                    });
            });
        };
        // markdown 编辑模式 右键菜单
        this.registerEvent(
            this.app.workspace.on(
                "editor-menu",
                (menu: Menu, editor: Editor, view: MarkdownView) => {
                    let selection = editor.getSelection();
                    if (
                        selection ||
                        selection.trim().length === selection.length
                    ) {
                        addMemu(menu, selection);
                    }
                }
            )
        );
        // markdown 预览模式 右键菜单
        this.registerDomEvent(document.body, "contextmenu", (evt) => {
            if (
                (evt.target as HTMLElement).matchParent(
                    ".markdown-preview-view"
                )
            ) {
                const selection = window.getSelection().toString().trim();
                if (!selection) return;

                evt.preventDefault();
                let menu = new Menu();

                addMemu(menu, selection);

                menu.showAtMouseEvent(evt);
            }
        });
    }

    // 管理所有的左键抬起
    registerMouseup() {
        this.registerDomEvent(document.body, "pointerup", (evt) => {
            const target = evt.target as HTMLElement;
            if (!target.matchParent(".stns")) {
                // 处理普通模式
                const funcKey = this.settings.function_key;
                if (
                    (funcKey === "disable" || evt[funcKey] === false) &&
                    !(
                        this.store.searchPinned &&
                        !target.matchParent("#langr-search,#langr-learn-panel")
                    )
                )
                    return;

                let selection = window.getSelection().toString().trim();
                if (!selection) return;

                evt.stopImmediatePropagation();
                this.queryWord(selection, null, { x: evt.pageX, y: evt.pageY });
                return;
            }
        });
    }

    // 管理所有的鼠标左击
    registerLeftClick() {
        this.registerDomEvent(document.body, "click", (evt) => {
            let target = evt.target as HTMLElement;
            if (
                target.tagName === "H4" &&
                target.matchParent("#sr-flashcard-view")
            ) {
                let word = target.textContent;
                let accent = this.settings.review_prons;
                let wordUrl =
                    `http://dict.youdao.com/dictvoice?type=${accent}&audio=` +
                    encodeURIComponent(word);
                playAudio(wordUrl);
            }
        });
    }

    async loadSettings() {
        let settings: { [K in string]: any } = Object.assign(
            {},
            DEFAULT_SETTINGS
        );
        let data = (await this.loadData()) || {};
        for (let key in DEFAULT_SETTINGS) {
            let k = key as keyof typeof DEFAULT_SETTINGS;
            if (data[k] === undefined) {
                continue;
            }

            if (typeof DEFAULT_SETTINGS[k] === "object") {
                Object.assign(settings[k], data[k]);
            } else {
                settings[k] = data[k];
            }
        }
        (this.settings as any) = settings;
        // this.settings = Object.assign(
        //     {},
        //     DEFAULT_SETTINGS,
        //     await this.loadData()
        // );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView(VIEW_TYPE: string, side: "left" | "right" | "tab") {
        // 检查当前工作空间中是否已经存在指定类型的视图
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length === 0) {
            // 如果没有找到指定类型的视图，则根据side参数创建一个新的视图叶节点
            let leaf;
            switch (side) {
                case "left":
                    // 如果side为"left"，获取左侧的叶节点
                    leaf = this.app.workspace.getLeftLeaf(false);
                    break;
                case "right":
                    // 如果side为"right"，获取右侧的叶节点
                    leaf = this.app.workspace.getRightLeaf(false);
                    break;
                case "tab":
                    // 如果side为"tab"，获取标签页叶节点
                    leaf = this.app.workspace.getLeaf("tab");
                    break;
            }
            // 设置叶节点的视图状态为指定的视图类型，并激活它
            await leaf.setViewState({
                type: VIEW_TYPE,
                active: true,
            });
        }
        // 确保指定类型的视图叶节点是可见的
        this.app.workspace.revealLeaf(
            // 获取第一个指定类型的视图叶节点
            this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]
        );
    }

    async checkPath() {
        if (this.settings.word_folder && this.settings.use_fileDB) {
            try {
                await app.vault.createFolder(this.settings.word_folder);
            } catch (err) {}
        }
    }

    async createWordfiles(words: string[]) {
        await this.checkPath();
        var path = this.settings.word_folder;
        let info = await this.db.getExprall(words); //单词所有信息
        //this.createMd(exprs,this.plugin.settings.word_folder,cont);
        for (const str of words) {
            if (path[path.length - 1] === "/") {
                var filePath = path + `${str}.md`;
            } else {
                var filePath = path + "/" + `${str}.md`;
            }
            var ExpressionInfo = info.find((info) => info.expression === str);
            var fm = await this.createFM(ExpressionInfo);
            try {
                await app.vault.create(filePath, fm);
            } catch (err) {
                if (err.message.includes("File already exists")) {
                    this.app.vault.adapter.write(normalizePath(filePath), fm);
                }
            }
        }
    }

    //直接生成frontmatter文本
    async createFM(cont: ExpressionInfo) {
        const status = statusMap[cont.status];
        const aliasesString = cont.aliases
            ? `aliases: \n${cont.aliases.map((line) => `- ${line}`).join("\n")}`
            : "";
        const tagsString = cont.tags.length
            ? `tags: \n${cont.tags.map((line) => `- ${line}`).join("\n")}`
            : "";
        const notesString = cont.notes.length
            ? `notes: \n${cont.notes.map((line) => `- '${line}'`).join("\n")}`
            : "";
        //const sentencesString = cont.sentences.length ? `sentences: \n${cont.sentences.map(sentence => `- ${sentence.text}-${sentence.trans}-${sentence.origin}`).join('\n')}` : 'sentences: \n';
        let sentenceCounter = 1;
        const sentencesString = cont.sentences.length
            ? `${cont.sentences
                  .map((sentence) => {
                      const result = `sentence${sentenceCounter}: '${sentence.text}'\ntrans${sentenceCounter}: '${sentence.trans}'\norigin${sentenceCounter}: '${sentence.origin}'`;
                      sentenceCounter++;
                      return result;
                  })
                  .join("\n")}`
            : "";
        // 格式化日期
        const formattedDate = moment
            .unix(cont.date)
            .format("YYYY-MM-DD HH:mm:ss");
        var fm = `---
expression: ${cont.expression}
meaning: '${cont.meaning}'
${aliasesString}
date: ${formattedDate}
status: ${status}
type: ${cont.t}
${tagsString}
${notesString}
${sentencesString}
---
`;

        return fm;
    }

    async updateWordfiles() {
        let wordsinfo = await this.db.getAllExpressionSimple(false);
        let words: string[] = wordsinfo.map((item) => item.expression);
        await this.createWordfiles(words);
    }

    async updateIndexDB() {
        let folderpath = this.settings.word_folder;
        await this.checkPath();
        var words = (
            await this.app.vault.adapter.list(normalizePath(folderpath))
        ).files;
        var ignorwords = (await this.db.getAllExpressionSimple(true))
            .filter((item) => item.status === 0)
            .flatMap((item) => [item.expression, ...item.aliases]);
        await this.db.destroyAll();
        await this.db.open();
        for (var wordpath of words) {
            var expressioninfo = await this.parserFM(wordpath);
            ignorwords = ignorwords.filter(
                (item) =>
                    ![
                        ...expressioninfo.aliases,
                        expressioninfo.expression,
                    ].includes(item)
            );
            let data = JSON.parse(JSON.stringify(expressioninfo));
            (data as any).expression = (data as any).expression
                .trim()
                .toLowerCase();
            await this.db.postExpression(data);
        }
        this.db.postIgnoreWords(ignorwords.filter((item) => item !== ""));
    }

    //解析某个单词文件的fm信息
    async parserFM(file_path: string) {
        var fm = this.app.metadataCache.getCache(file_path).frontmatter;
        const {
            expression = "",
            meaning = "",
            status = "",
            type = "",
            tags = [],
            notes = [],
            aliases = [],
            date = "",
        } = fm;
        var sentences: Sentence[] = [];
        for (var i = 1; i < Object.keys(fm).length; i++) {
            var key = `sentence${i}`;

            if (key in fm) {
                let newSentence: Sentence = {
                    text: fm[key],
                    trans: fm[`trans${i}`],
                    origin: fm[`origin${i}`],
                };
                sentences.push(newSentence);
            } else {
                break;
            }
        }
        var expressioninfo: ExpressionInfo = {
            expression: expression,
            meaning: meaning,
            status: statusMap.indexOf(status),
            t: type,
            tags: tags,
            notes: notes,
            aliases: aliases,
            date: moment.utc(date).unix(),
            sentences: sentences,
        };
        return expressioninfo;
    }

    //解析所有单词文件的fm信息
    async parserAllFM() {
        this.checkPath();
        var filesPath = (
            await this.app.vault.adapter.list(
                normalizePath(this.settings.word_folder)
            )
        ).files;
        var wordsinfo: ExpressionInfo[] = [];
        for (var filepath of filesPath) {
            var expressioninfo = await this.parserFM(filepath);
            wordsinfo.push(expressioninfo);
        }
        return wordsinfo;
    }
}

export function processContent() {
    // 获取包含特定class的元素

    let textArea = document.querySelector(".text-area");

    if (textArea) {
        let htmlContent = textArea.innerHTML;
        //使用正则表达式匹配同时包含特定符号的 <p> 标签元素，并去除所有标签保留文本
        htmlContent = htmlContent.replace(
            /<p>(?=.*!)(?=.*\[)(?=.*\])(?=.*\()(?=.*\)).*<\/p>/g,
            function (match) {
                var pattern = /!\[(.*?)\]\((.*?)\)/;
                var str = match.replace(/<[^>]+>/g, "");
                var tq = pattern.exec(str);
                var img = document.createElement("img");
                var imgContainer = document.createElement("div");
                imgContainer.style.textAlign = "center"; // 设置文本居中对齐
                var imgWrapper = document.createElement("div");
                imgWrapper.style.textAlign = "center"; // 设置为内联块元素，使其水平居中

                if (tq) {
                    var altText = tq[1];
                    var srcUrl = tq[2];

                    if (/^https?:\/\//.test(srcUrl)) {
                        img.alt = altText;
                        img.src = srcUrl;
                        imgWrapper.appendChild(img);
                        imgContainer.appendChild(imgWrapper);
                        return imgContainer.innerHTML;
                    } else {
                        img.alt = altText;
                        img.src = mergeStrings(imgnum, srcUrl);
                        imgWrapper.appendChild(img);
                        imgContainer.appendChild(imgWrapper);
                        return imgContainer.innerHTML;
                    }
                }
            }
        );
        // 渲染多级标题
        htmlContent = htmlContent.replace(
            /(<span class="stns">)# (.*?)(<\/span>)(?=\s*<\/p>)/g,
            "<h1>$1$2$3</h1>"
        );
        htmlContent = htmlContent.replace(
            /(<span class="stns">)## (.*?)(<\/span>)(?=\s*<\/p>)/g,
            "<h2>$1$2$3</h2>"
        );
        htmlContent = htmlContent.replace(
            /(<span class="stns">)### (.*?)(<\/span>)(?=\s*<\/p>)/g,
            "<h3>$1$2$3</h3>"
        );
        htmlContent = htmlContent.replace(
            /(<span class="stns">)#### (.*?)(<\/span>)(?=\s*<\/p>)/g,
            "<h4>$1$2$3</h4>"
        );
        htmlContent = htmlContent.replace(
            /(<span class="stns">)##### (.*?)(<\/span>)(?=\s*<\/p>)/g,
            "<h5>$1$2$3</h5>"
        );
        htmlContent = htmlContent.replace(
            /(<span class="stns">)###### (.*?)(<\/span>)(?=\s*<\/p>)/g,
            "<h6>$1$2$3</h6>"
        );

        //渲染粗体
        htmlContent = htmlContent.replace(
            /(?<!\\)\*(?<!\\)\*(<span.*?>.*?<\/span>)(?<!\\)\*(?<!\\)\*/g,
            "<b>$1</b>"
        );
        htmlContent = htmlContent.replace(
            /(?<!\\)\_(?<!\\)\_(<span.*?>.*?<\/span>)(?<!\\)\_(?<!\\)\_/g,
            "<b>$1</b>"
        );

        //渲染斜体
        htmlContent = htmlContent.replace(
            /(?<!\\)\*(<span.*?>.*?<\/span>)(?<!\\)\*/g,
            "<i>$1</i>"
        );
        htmlContent = htmlContent.replace(
            /(?<!\\)\_(<span.*?>.*?<\/span>)(?<!\\)\_/g,
            "<i>$1</i>"
        );

        htmlContent = htmlContent.replace(
            /(?<!\\)\~(?<!\\)\~(<span.*?>.*?<\/span>)(?<!\\)\~(?<!\\)\~/g,
            "<del>$1</del>"
        );

        textArea.innerHTML = htmlContent;
    } else {
        // 查找页面中的 img 元素并提取 imgnum 并存储到 localStorage 中
        var imgElements = document.getElementsByTagName("img");
        for (var i = 0; i < imgElements.length; i++) {
            if (imgElements[i].getAttribute("src")) {
                imgnum = imgElements[i].getAttribute("src");

                if (!imgnum.includes("http")) {
                    localStorage.setItem("imgnum", imgnum); // 存储到本地存储中
                    break; // 如果找到了，可以选择跳出循环
                }
            }
        }
    }
}

function mergeStrings(str1: string, str2: string) {
    // 获取 str2 的前 3 个字符
    let prefix = str2.substring(0, 3);
    // 在 str1 中查找 prefix 的位置
    let index = str1.indexOf(prefix);

    // 如果找到匹配的前缀
    if (index !== -1 && index !== 0 && str1.charAt(index - 1) === "/") {
        // 截断 str1 并与 str2 相连
        let firstPart = str1.substring(0, index);
        return firstPart + str2;
    } else {
        // 如果没有找到匹配的前缀，则返回 str1 和 str2 原样相连
        return str1 + str2;
    }
}

async function fetchData() {
    let previousContent = ""; // 上一次抓取到的内容
    return new Promise((resolve, reject) => {
        let intervalId = setInterval(() => {
            let textArea = document.querySelector(".text-area");

            if (textArea) {
                let currentContent = textArea.innerHTML.trim();

                // 检查 textArea 中是否包含 class 为 'article' 的元素
                let hasArticleClass =
                    textArea.querySelector(".article") !== null;

                if (hasArticleClass) {
                    clearInterval(intervalId); // 内容无变化时清除定时器
                    resolve(currentContent); // 解析 Promise，传递最终内容
                } else {
                    previousContent = currentContent; // 更新上一次抓取的内容
                }
            } else {
                clearInterval(intervalId); // 内容无变化时清除定时器
                console.warn(".text-area element not found");
            }
        }, 100);
    });
}
