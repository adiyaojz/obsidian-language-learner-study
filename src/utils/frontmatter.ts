import { App, TFile, parseYaml, stringifyYaml } from "obsidian";

// 定义一个名为 FrontMatter 的类型，它是一个索引类型，键为字符串，值也为字符串
type FrontMatter = { [K in string]: string };

// 定义一个名为 FrontMatterManager 的类
export class FrontMatterManager {
    // 存储 Obsidian 应用实例
    app: App;

    // 构造函数，接收一个 Obsidian 应用实例作为参数，并将其赋值给类的属性 app
    constructor(app: App) {
        this.app = app;
    }

    // 加载文件的前导内容（Front Matter）的方法
    async loadFrontMatter(file: TFile): Promise<FrontMatter> { 
        // 创建一个空的 FrontMatter 对象，用于存储解析后的前导内容
        let res = {} as FrontMatter;
        // 读取指定文件的内容
        let text = await this.app.vault.read(file);

        // 使用正则表达式匹配文件内容中的前导内容部分
        let match = text.match(/^\n*---\n([\s\S]+)\n---/);
        // 如果找到了前导内容
        if (match) {
            // 使用 parseYaml 函数解析前导内容，并将结果存储在 res 中
            res = parseYaml(match[1]);
        }

        // 返回解析后的前导内容
        return res;
    }

    // 存储前导内容到文件的方法
    async storeFrontMatter(file: TFile, fm: FrontMatter) {
        // 如果前导内容为空对象（没有任何键值对），则直接返回，不进行存储操作
        if (Object.keys(fm).length === 0) {
            return;
        }

        // 读取指定文件的内容
        let text = await this.app.vault.read(file);
        // 使用正则表达式匹配文件内容中的前导内容部分
        let match = text.match(/^\n*---\n([\s\S]+)\n---/);

        // 创建一个新的文件内容字符串
        let newText = "";
        // 将传入的前导内容对象转换为 YAML 格式的字符串
        let newFront = stringifyYaml(fm);
        // 如果文件中原本存在前导内容
        if (match) {
            // 使用新的前导内容替换旧的前导内容，并生成新的文件内容字符串
            newText = text.replace(/^\n*---\n([\s\S]+)\n---/, `---\n${newFront}---`);
        } else {
            // 如果文件中原本没有前导内容，在文件开头添加新的前导内容，并生成新的文件内容字符串
            newText = `---\n${newFront}---\n\n` + text;
        }

        // 使用 Obsidian 的 vault 对象修改指定文件的内容为新的文件内容字符串
        this.app.vault.modify(file, newText);
    }

    // 获取指定文件中特定键的前导内容值的方法
    async getFrontMatter(file: TFile, key: string): Promise<string> {
        // 加载指定文件的前导内容
        let frontmatter = await this.loadFrontMatter(file);

        // 返回指定键对应的值，如果键不存在，则返回 undefined，在这种情况下，TS 会将其转换为字符串类型的 undefined
        return frontmatter[key];
    }

    // 设置指定文件中特定键的前导内容值的方法
    async setFrontMatter(file: TFile, key: string, value: string) {
        // 加载指定文件的前导内容
        let fm = await this.loadFrontMatter(file);

        // 设置指定键的值为传入的新值
        fm[key] = value;

        // 将更新后的前导内容存储到文件中
        this.storeFrontMatter(file, fm);
    }
}