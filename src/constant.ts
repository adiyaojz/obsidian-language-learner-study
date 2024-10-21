import { t } from "./lang/helper";
// 从指定路径导入名为 t 的函数，推测可能用于国际化或翻译等用途

const dict = {
    NAME: "Language Learner"
};
// 创建一个名为 dict 的常量对象，其中包含一个名为 NAME 的属性，值为 "Language Learner"

type Position = {
    x: number;
    y: number;
};
// 定义一个名为 Position 的类型，包含两个属性 x 和 y，类型都是 number

interface EventMap extends GlobalEventHandlersEventMap {
    "obsidian-langr-search": CustomEvent<{
        selection: string,
        target?: HTMLElement,
        evtPosition?: Position,
    }>;
    "obsidian-langr-refresh": CustomEvent<{
        expression: string,
        type: string,
        status: number,
    }>;
    "obsidian-langr-refresh-stat": CustomEvent<{}>;
};
// 定义一个名为 EventMap 的接口，它继承自 GlobalEventHandlersEventMap（全局事件处理程序的事件映射接口）。
// 这个接口扩展了三个自定义事件：
// "obsidian-langr-search"：一个自定义事件，携带一个对象，包含 selection 属性（类型为 string），以及可选的 target 属性（类型为 HTMLElement）和 evtPosition 属性（类型为 Position）。
// "obsidian-langr-refresh"：一个自定义事件，携带一个对象，包含 expression 属性（类型为 string）、type 属性（类型为 string）和 status 属性（类型为 number）。
// "obsidian-langr-refresh-stat"：一个自定义事件，携带一个空对象。

export { dict };
// 导出 dict 常量对象，使得其他模块可以使用它

export type { EventMap, Position };
// 导出 EventMap 接口和 Position 类型，使得其他模块可以使用它们来进行类型声明。