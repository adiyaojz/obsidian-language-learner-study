import { moment } from "obsidian";
import { createAutomaton, Automaton } from "ac-auto";
import { exportDB, importInto } from "dexie-export-import";
import download from "downloadjs";

import {
    ArticleWords,
    Word,
    Phrase,
    WordsPhrase,
    Sentence,
    ExpressionInfo,
    ExpressionInfoSimple,
    CountInfo,
    WordCount,
    Span,
} from "./interface";
import DbProvider from "./base";
import WordDB from "./idb";
import Plugin from "@/plugin";

export class LocalDb extends DbProvider {
    idb: WordDB;
    plugin: Plugin;
    constructor(plugin: Plugin) {
        super();
        this.plugin = plugin;
        this.idb = new WordDB(plugin);
    }

    async open() {
        await this.idb.open();
        return;
    }

    close() {
        this.idb.close();
    }

    // 寻找页面中已经记录过的单词和词组
    async getStoredWords(payload: ArticleWords): Promise<WordsPhrase> {
        // 创建一个用于存储词组及其状态的映射
        let storedPhrases = new Map<string, number>();
        // 在数据库的 expressions 表中查询类型为“PHRASE”的记录，并将其词组和状态存入映射中
        await this.idb.expressions
            .where("t")
            .equals("PHRASE")
            .each((expr) => storedPhrases.set(expr.expression, expr.status));

        // 在数据库的 expressions 表中查询与传入的 words 数组中任何一个单词匹配的记录，并将其转换为 Word 类型数组
        let storedWords = (
            await this.idb.expressions
                .where("expression")
                .anyOf(payload.words)
                .toArray()
        ).map((expr) => {
            return { text: expr.expression, status: expr.status } as Word;
        });

        // 使用存储的词组创建自动机
        let ac = await createAutomaton([...storedPhrases.keys()]);
        // 在传入的文章中搜索存储的词组，将搜索结果转换为 Phrase 类型数组
        let searchedPhrases = (await ac.search(payload.article)).map(
            (match) => {
                return {
                    text: match[1],
                    status: storedPhrases.get(match[1]),
                    offset: match[0],
                } as Phrase;
            }
        );

        // 返回包含找到的单词和词组的对象
        return { words: storedWords, phrases: searchedPhrases };
    }

    // 根据给定的单词或词组查询其详细信息
    async getExpression(expression: string): Promise<ExpressionInfo> {
        // 将输入的表达式转换为小写形式
        expression = expression.toLowerCase();
        // 在数据库的 expressions 表中查询与给定表达式匹配的第一个记录
        let expr = await this.idb.expressions
            .where("expression")
            .equals(expression)
            .first();

        // 如果没有找到匹配的记录，则返回 null
        if (!expr) {
            return null;
        }

        // 在数据库的 sentences 表中查询与找到的表达式对应的句子记录
        let sentences = await this.idb.sentences
            .where("id")
            .anyOf([...expr.sentences.values()])
            .toArray();

        // 返回包含表达式详细信息的对象
        return {
            expression: expr.expression,
            meaning: expr.meaning,
            status: expr.status,
            t: expr.t,
            notes: expr.notes,
            sentences,
            tags: [...expr.tags.keys()],
            aliases: expr.aliases,
        };
    }

    // 根据给定的一组表达式查询其简略信息
    async getExpressionsSimple(
        expressions: string[]
    ): Promise<ExpressionInfoSimple[]> {
        // 将输入的表达式数组中的每个表达式转换为小写形式
        expressions = expressions.map((e) => e.toLowerCase());

        // 在数据库的 expressions 表中查询与输入的表达式数组中任何一个表达式匹配的记录，并转换为数组
        let exprs = await this.idb.expressions
            .where("expression")
            .anyOf(expressions)
            .toArray();

        // 将查询到的表达式记录转换为 ExpressionInfoSimple 类型的数组并返回
        return exprs.map((v) => {
            return {
                expression: v.expression,
                meaning: v.meaning,
                status: v.status,
                t: v.t,
                tags: [...v.tags.keys()],
                sen_num: v.sentences.size,
                note_num: v.notes.length,
                date: v.date,
                aliases: v.aliases,
            };
        });
    }

    // 查询在给定时间之后添加的单词的详细信息
    async getExpressionAfter(time: string): Promise<ExpressionInfo[]> {
        // 将给定的时间字符串转换为 Unix 时间戳
        let unixStamp = moment.utc(time).unix();
        // 在数据库的 expressions 表中查询状态大于 0 且日期大于给定时间戳的记录，并转换为数组
        let wordsAfter = await this.idb.expressions
            .where("status")
            .above(0)
            .and((expr) => expr.date > unixStamp)
            .toArray();

        // 创建一个用于存储查询结果的数组
        let res: ExpressionInfo[] = [];
        // 遍历查询到的记录
        for (let expr of wordsAfter) {
            // 在数据库的 sentences 表中查询与当前记录对应的句子记录，并转换为数组
            let sentences = await this.idb.sentences
                .where("id")
                .anyOf([...expr.sentences.values()])
                .toArray();

            // 将当前记录的详细信息添加到结果数组中
            res.push({
                expression: expr.expression,
                meaning: expr.meaning,
                status: expr.status,
                t: expr.t,
                notes: expr.notes,
                sentences,
                tags: [...expr.tags.keys()],
                aliases: expr.aliases,
            });
        }
        // 返回查询结果数组
        return res;
    }

    // 获取所有单词的简略信息
    async getAllExpressionSimple(
        ignores?: boolean
    ): Promise<ExpressionInfoSimple[]> {
        // 定义一个变量用于存储查询结果的数组
        let exprs: ExpressionInfoSimple[];
        // 根据是否忽略某些单词来确定查询的最低状态值
        let bottomStatus = ignores ? -1 : 0;
        // 在数据库的 expressions 表中查询状态大于等于最低状态值的记录，并转换为数组
        exprs = (
            await this.idb.expressions
                .where("status")
                .above(bottomStatus)
                .toArray()
        ).map((expr): ExpressionInfoSimple => {
            // 将查询到的记录转换为 ExpressionInfoSimple 类型并返回
            return {
                expression: expr.expression,
                status: expr.status,
                meaning: expr.meaning,
                t: expr.t,
                tags: [...expr.tags.keys()],
                note_num: expr.notes.length,
                sen_num: expr.sentences.size,
                date: expr.date,
                aliases: expr.aliases,
            };
        });
        // 返回查询结果数组
        return exprs;
    }

    // 发送单词信息到数据库保存
    async postExpression(payload: ExpressionInfo): Promise<number> {
        // 在数据库的 expressions 表中查询与传入的单词信息中表达式相同的记录
        let stored = await this.idb.expressions
            .where("expression")
            .equals(payload.expression)
            .first();

        // 创建一个用于存储句子编号的集合
        let sentences = new Set<number>();
        // 遍历传入的句子信息
        for (let sen of payload.sentences) {
            // 在数据库的 sentences 表中查询与当前句子文本相同的记录
            let searched = await this.idb.sentences
                .where("text")
                .equals(sen.text)
                .first();
            if (searched) {
                // 如果找到记录，更新该记录并将其编号添加到集合中
                await this.idb.sentences.update(searched.id, sen);
                sentences.add(searched.id);
            } else {
                // 如果未找到记录，添加新记录并将其编号添加到集合中
                let id = await this.idb.sentences.add(sen);
                sentences.add(id);
            }
        }

        // 创建一个更新后的单词信息对象
        let updatedWord = {
            expression: payload.expression,
            meaning: payload.meaning,
            status: payload.status,
            t: payload.t,
            notes: payload.notes,
            sentences,
            tags: new Set<string>(payload.tags),
            connections: new Map<string, string>(),
            date: moment().unix(),
            aliases: payload.aliases,
        };
        if (stored) {
            // 如果数据库中已存在该单词记录，更新该记录
            await this.idb.expressions.update(stored.id, updatedWord);
        } else {
            // 如果数据库中不存在该单词记录，添加新记录
            await this.idb.expressions.add(updatedWord);
        }

        // 返回状态码 200
        return 200;
    }

    // 获取所有标签
    async getTags(): Promise<string[]> {
        // 创建一个用于存储所有标签的集合
        let allTags = new Set<string>();
        // 遍历数据库的 expressions 表中的所有记录
        await this.idb.expressions.each((expr) => {
            // 将每个记录中的标签添加到集合中
            for (let t of expr.tags.values()) {
                allTags.add(t);
            }
        });

        // 将集合转换为数组并返回
        return [...allTags.values()];
    }

    // 批量发送单词，全部标记为 ignore
    async postIgnoreWords(payload: string[]): Promise<void> {
        // 批量插入新的记录到 expressions 表，将传入的单词标记为忽略状态（状态为 0）
        await this.idb.expressions.bulkPut(
            payload.map((expr) => {
                return {
                    expression: expr,
                    meaning: "",
                    status: 0,
                    t: "WORD",
                    notes: [],
                    sentences: new Set(),
                    tags: new Set(),
                    connections: new Map<string, string>(),
                    date: moment().unix(),
                    aliases: [],
                };
            })
        );
        return;
    }

    // 查询一个例句是否已经记录过
    async tryGetSen(text: string): Promise<Sentence> {
        // 在数据库的 sentences 表中查询与给定文本相同的第一个记录
        let stored = await this.idb.sentences
            .where("text")
            .equals(text)
            .first();
        return stored;
    }

    // 获取各类单词的个数
    async getCount(): Promise<CountInfo> {
        // 创建一个对象用于存储单词和词组的计数，初始值为长度为 5 的数组，每个元素初始值为 0
        let counts: { WORD: number[]; PHRASE: number[] } = {
            WORD: new Array(5).fill(0),
            PHRASE: new Array(5).fill(0),
        };
        // 遍历数据库的 expressions 表中的所有记录
        await this.idb.expressions.each((expr) => {
            // 根据记录的类型（WORD 或 PHRASE）和状态更新计数
            counts[expr.t as "WORD" | "PHRASE"][expr.status]++;
        });

        // 返回包含单词和词组计数的对象
        return {
            word_count: counts.WORD,
            phrase_count: counts.PHRASE,
        };
    }
    // 获取 7 天内的统计信息
    async countSeven(): Promise<WordCount[]> {
        // 创建一个数组用于存储七天的时间跨度信息
        let spans: Span[] = [];
        // 遍历数字 0 到 6，生成七天的时间跨度信息
        spans = [0, 1, 2, 3, 4, 5, 6].map((i) => {
            let start = moment().subtract(6, "days").startOf("day");
            let from = start.add(i, "days");
            return {
                from: from.unix(),
                to: from.endOf("day").unix(),
            };
        });

        // 创建一个用于存储统计结果的数组
        let res: WordCount[] = [];

        // 对每一天计算
        for (let span of spans) {
            // 当日
            let today = new Array(5).fill(0);
            // 过滤出当天的单词记录，并更新当天的统计信息
            await this.idb.expressions
                .filter((expr) => {
                    return (
                        expr.t === "WORD" &&
                        expr.date >= span.from &&
                        expr.date <= span.to
                    );
                })
                .each((expr) => {
                    today[expr.status]++;
                });
            // 累计
            let accumulated = new Array(5).fill(0);
            // 过滤出截至当天的单词记录，并更新累计的统计信息
            await this.idb.expressions
                .filter((expr) => {
                    return expr.t === "WORD" && expr.date <= span.to;
                })
                .each((expr) => {
                    accumulated[expr.status]++;
                });

            // 将当天和累计的统计信息添加到结果数组中
            res.push({ today, accumulated });
        }

        // 返回七天的统计信息数组
        return res;
    }

    // 导入数据库
    async importDB(file: File) {
        // 删除现有的数据库
        await this.idb.delete();
        // 打开新的数据库连接
        await this.idb.open();
        // 从给定的文件中导入数据到数据库
        await importInto(this.idb, file, {
            acceptNameDiff: true,
        });
    }

    // 导出数据库
    async exportDB() {
        // 导出数据库为 Blob 对象
        let blob = await exportDB(this.idb);
        try {
            // 下载导出的数据库文件
            download(blob, `${this.idb.dbName}.json`, "application/json");
        } catch (e) {
            // 如果下载出错，打印错误信息
            console.error("error exporting database");
        }
    }

    // 销毁数据库
    async destroyAll() {
        // 删除数据库
        return this.idb.delete();
    }
}
