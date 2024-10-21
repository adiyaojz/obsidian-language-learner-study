import { unified, Processor } from "unified"; // 导入unified库的统一接口和处理器
import retextEnglish from "retext-english"; // 导入retext-english插件，用于处理英文文本
import { Root, Content, Literal, Parent, Sentence } from "nlcst"; // 导入自然语言混凝土语法树（NLCST）的节点类型
import { modifyChildren } from "unist-util-modify-children"; // 导入unist-util-modify-children库，用于修改AST的子节点
import { visit } from "unist-util-visit"; // 导入unist-util-visit库，用于访问AST的节点
import { toString } from "nlcst-to-string"; // 导入nlcst-to-string库，用于将NLCST节点转换为字符串

import { Phrase, Word } from "@/db/interface"; // 导入数据库接口
import Plugin from "@/plugin"; // 导入自定义插件

const STATUS_MAP = ["ignore", "learning", "familiar", "known", "learned"]; // 定义单词状态映射
type AnyNode = Root | Content | Content[]; // 定义任意节点类型，可以是Root、Content或Content数组
export var state = { loading_flag: false }; // 导出状态变量，用于控制加载标志
// 定义TextParser类，用于解析文本
export class TextParser {
    // 记录短语位置
    phrases: Phrase[] = [];
    // 记录单词状态
    words: Map<string, Word> = new Map<string, Word>();
    pIdx: number = 0; // 短语索引
    plugin: Plugin; // 自定义插件
    processor: Processor; // unified处理器

    // 构造函数，接收一个插件对象
    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.processor = unified() // 创建unified处理器
            .use(retextEnglish) // 使用retextEnglish插件
            .use(this.addPhrases()) // 使用自定义的短语添加插件
            .use(this.stringfy2HTML()); // 使用自定义的HTML字符串化插件
    }

    // 解析文本并返回HTML字符串
    async parse(data: string) {
        let newHTML = await this.text2HTML(data.trim());
        return newHTML;
    }

    async countWords(text: string): Promise<[number, number, number]> {
        const ast = this.processor.parse(text); // 解析文本为AST
        let wordSet: Set<string> = new Set(); // 创建单词集合
        visit(ast, "WordNode", (word) => {
            // 访问AST中的WordNode节点
            let text = toString(word).toLowerCase(); // 将单词转换为小写字符串
            if (/[0-9\u4e00-\u9fa5]/.test(text)) return; // 忽略数字和中文字符
            wordSet.add(text); // 添加单词到集合
        });
        // await this.plugin.checkPath(); // 检查插件路径
        let stored = await this.plugin.db.getStoredWords({
            // 从数据库获取存储的单词
            article: "",
            words: [...wordSet],
        });
        let ignore = 0; // 忽略的单词数量
        stored.words.forEach((word) => {
            // 遍历存储的单词
            if (word.status === 0) ignore++; // 统计忽略的单词数量
        });
        let learn = stored.words.length - ignore; // 学习中的单词数量
        let unknown = wordSet.size - stored.words.length; // 未知的单词数量
        return [unknown, learn, ignore]; // 返回统计结果
    }

    // 将文本转换为HTML字符串
    async text2HTML(text: string) {
        this.pIdx = 0; // 重置短语索引
        this.words.clear(); // 清空单词状态映射
        // await this.plugin.checkPath(); // 检查插件路径
        // 查找已知短语，用于构造AST中的PhraseNode
        this.phrases = (
            await this.plugin.db.getStoredWords({
                article: text.toLowerCase(), // 文章内容
                words: [],
            })
        ).phrases;

        const ast = this.processor.parse(text); // 将文本解析为AST
        // 获得文章中去重后的单词
        let wordSet: Set<string> = new Set();
        visit(ast, "WordNode", (word) => {
            wordSet.add(toString(word).toLowerCase());
        });
        
        // 查询这些单词的status
        let stored = await this.plugin.db.getStoredWords({
            article: "",
            words: [...wordSet],
        });

        stored.words.forEach((w) => this.words.set(w.text, w)); // 更新单词状态映射
        let HTML = this.processor.stringify(ast) as any as string; // 将AST字符串化为HTML
        return HTML;
    }

    // 获取文本中的单词和短语
    async getWordsPhrases(text: string) {
        const ast = this.processor.parse(text); // 解析文本为AST
        let words: Set<string> = new Set(); // 创建单词集合
        visit(ast, "WordNode", (word) => {
            // 访问AST中的WordNode节点
            words.add(toString(word).toLowerCase()); // 添加单词到集合
        });
        let wordsPhrases = await this.plugin.db.getStoredWords({
            // 从数据库获取存储的单词和短语
            article: text.toLowerCase(),
            words: [...words],
        });

        let payload = [] as string[]; // 创建payload数组
        wordsPhrases.phrases.forEach((word) => {
            // 遍历短语
            if (word.status > 0) payload.push(word.text); // 添加状态大于0的短语
        });
        wordsPhrases.words.forEach((word) => {
            // 遍历单词
            if (word.status > 0) payload.push(word.text); // 添加状态大于0的单词
        });
        // await this.plugin.checkPath(); // 检查插件路径
        let res = await this.plugin.db.getExpressionsSimple(payload); // 获取表达式
        return res; // 返回结果
    }
    // 自定义插件：在retextEnglish基础上，把AST上一些单词包裹成短语
    addPhrases() {
        let selfThis = this; // 保存当前类的上下文
        return function (option = {}) {
            // 返回一个插件函数
            const proto = this.Parser.prototype; // 获取Parser原型
            proto.useFirst("tokenizeParagraph", selfThis.phraseModifier); // 使用phraseModifier函数
        };
    }

    phraseModifier = modifyChildren(this.wrapWord2Phrase.bind(this)); // 使用modifyChildren修改子节点

    // 将单词包裹成短语
    wrapWord2Phrase(node: Content, index: number, parent: Parent) {
        if (!node.hasOwnProperty("children")) return; // 如果节点没有子节点，返回

        if (
            this.pIdx >= this.phrases.length || // 如果短语索引超出范围
            node.position.end.offset <= this.phrases[this.pIdx].offset // 如果节点的结束位置小于等于当前短语的开始位置
        )
            return;

        let children = (node as Sentence).children; // 获取子节点

        let p: number; // 定义查找索引的变量
        while (
            (p = children.findIndex(
                // 查找匹配的子节点
                (child) =>
                    child.position.start.offset ===
                    this.phrases[this.pIdx].offset
            )) !== -1
        ) {
            let q = children.findIndex(
                // 查找匹配的结束子节点
                (child) =>
                    child.position.end.offset ===
                    this.phrases[this.pIdx].offset +
                        this.phrases[this.pIdx].text.length
            );

            if (q === -1) {
                // 如果没有找到匹配的结束子节点
                this.pIdx++; // 增加短语索引
                return;
            }
            let phrase = children.slice(p, q + 1); // 获取短语的子节点
            children.splice(p, q - p + 1, {
                // 替换子节点
                type: "PhraseNode",
                children: phrase,
                position: {
                    start: { ...phrase.first().position.start },
                    end: { ...phrase.last().position.end },
                },
            } as any);

            this.pIdx++; // 增加短语索引

            if (
                this.pIdx >= this.phrases.length || // 如果短语索引超出范围
                node.position.end.offset <= this.phrases[this.pIdx].offset // 如果节点的结束位置小于等于当前短语的开始位置
            )
                return;
        }
    }

    // 自定义插件：在AST转换为string时包裹上相应标签
    stringfy2HTML() {
        let selfThis = this; // 保存当前类的上下文

        return function () {
            // 返回一个插件函数
            Object.assign(this, {
                // 合并对象
                Compiler: selfThis.compileHTML.bind(selfThis), // 绑定compileHTML函数
            });
        };
    }

    // 将AST编译为HTML字符串
    compileHTML(tree: Root): string {
        return this.toHTMLString(tree); // 调用toHTMLString函数
    }

    // 将AST节点转换为HTML字符串
    toHTMLString(node: AnyNode): string {
        if (node.hasOwnProperty("value")) {
            // 如果节点有value属性
            return (node as Literal).value; // 返回节点的值
        }
        if (node.hasOwnProperty("children")) {
            // 如果节点有children属性
            let n = node as Parent; // 将节点转换为Parent类型
            switch (
                n.type // 根据节点类型
            ) {
                case "WordNode": {
                    // 如果是WordNode
                    let text = toString(n.children); // 获取子节点的字符串
                    let textLower = text.toLowerCase(); // 转换为小写
                    let status = this.words.has(textLower) // 如果单词状态映射中有这个单词
                        ? STATUS_MAP[this.words.get(textLower).status] // 获取状态
                        : "new"; // 否则状态为new

                    return /[0-9\u4e00-\u9fa5]/.test(text) // 如果是数字或中文字符
                        ? `<span class="other">${text}</span>` // 使用other类
                        : `<span class="word ${status}">${text}</span>`; // 使用word类和状态
                }
                case "PhraseNode": {
                    // 如果是PhraseNode
                    let childText = toString(n.children); // 获取子节点的字符串
                    let text = this.toHTMLString(n.children); // 递归转换子节点
                    // 获取词组的status
                    let phrase = this.phrases.find(
                        (p) => p.text === childText.toLowerCase()
                    );
                    let status = STATUS_MAP[phrase.status]; // 获取状态

                    return `<span class="phrase ${status}">${text}</span>`; // 使用phrase类和状态
                }
                case "SentenceNode": {
                    // 如果是SentenceNode
                    return `<span class="stns">${this.toHTMLString(
                        n.children
                    )}</span>`; // 使用stns类
                }
                case "ParagraphNode": {
                    // 如果是ParagraphNode
                    return `<p>${this.toHTMLString(n.children)}</p>`; // 使用p标签
                }
                default: {
                    // 默认情况
                    return `<div class="article">${this.toHTMLString(
                        n.children
                    )}</div>`; // 使用article类
                }
            }
        }
        if (Array.isArray(node)) {
            // 如果节点是数组
            let nodes = node as Content[]; // 将节点转换为Content数组
            return nodes.map((n) => this.toHTMLString(n)).join(""); // 递归转换并连接字符串
        }
    }
}
