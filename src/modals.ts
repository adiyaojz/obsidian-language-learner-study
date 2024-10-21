import { text } from "node:stream/consumers";
import { App, Modal, Setting } from "obsidian";
import { t } from "./lang/helper";



// 输入文字的模态框
class InputModal extends Modal {
    text: string = ""; // 用于存储输入框中的文本
    onSubmit: (text: string) => void; // 提交文本时的回调函数
    constructor(app: App, onSubmit: (text: string) => void) {
        super(app); // 调用父类构造函数
        this.onSubmit = onSubmit; // 设置回调函数
    }

    onOpen() {
        const { contentEl } = this; // 获取模态框的内容元素
        contentEl.createEl("h3", { // 创建标题
            text: "Input Text",
            attr: {
                style: "margin: 10px 0;",
            }
        });

        let inputEl = contentEl.createEl("input", { // 创建输入框
            attr: {
                type: "text",
                style: "width: 100%;"
            }
        });

        inputEl.addEventListener("input", (evt) => { // 监听输入事件
            this.text = inputEl.value; // 更新文本
        });

        inputEl.addEventListener("keydown", (evt) => { // 监听键盘按下事件
            if (evt.key === "Enter") { // 如果按下的是 Enter 键
                evt.preventDefault(); // 阻止默认行为
                evt.stopPropagation(); // 阻止事件冒泡
                this.onSubmit(this.text); // 提交文本
                this.close(); // 关闭模态框
            }
        });
    }
}


// 打开文件的模态框
class OpenFileModal extends Modal {
    input: HTMLInputElement; // 文件输入元素
    file: File; // 选择的文件
    onSubmit: (file: File) => Promise<void>; // 提交文件时的回调函数
    constructor(app: App, onSubmit: (file: File) => Promise<void>) {
        super(app); // 调用父类构造函数
        this.onSubmit = onSubmit; // 设置回调函数
    }

    onOpen() {
        const { contentEl } = this; // 获取模态框的内容元素

        this.input = contentEl.createEl("input", { // 创建文件输入框
            attr: {
                type: "file"
            }
        });

        this.input.addEventListener("change", () => { // 监听文件选择变化事件
            this.file = this.input.files[0]; // 更新选择的文件
        });

        new Setting(contentEl) // 创建设置按钮
            .addButton(button => button
                .setButtonText(t("Yes")) // 设置按钮文本
                .onClick((evt) => { // 监听按钮点击事件
                    this.onSubmit(this.file); // 提交文件
                    this.close(); // 关闭模态框
                })
            );
    }

    onClose(): void {
        // 模态框关闭时的逻辑（当前为空）
    }
}


// 警告模态框
class WarningModal extends Modal {
    onSubmit: () => Promise<void>; // 提交时的回调函数
    message: string; // 警告消息

    constructor(app: App, message: string, onSubmit: () => Promise<void>) {
        super(app); // 调用父类构造函数
        this.message = message; // 设置警告消息
        this.onSubmit = onSubmit; // 设置回调函数
    }

    onOpen() {
        const { contentEl } = this; // 获取模态框的内容元素

        contentEl.createEl("h2", { text: this.message }); // 显示警告消息

        new Setting(contentEl) // 创建设置按钮
            .addButton((btn) => btn
                .setButtonText(t("Yes")) // 设置按钮文本
                .setWarning() // 设置为警告按钮
                .setCta() // 设置为呼吁行动按钮
                .onClick(() => { // 监听按钮点击事件
                    this.close(); // 关闭模态框
                    this.onSubmit(); // 提交操作
                })
            )
            .addButton((btn) => btn
                .setButtonText(t("No!!!")) // 设置按钮文本
                .setCta() // 设置为呼吁行动按钮
                .onClick(() => { // 监听按钮点击事件
                    this.close(); // 关闭模态框
                }));
    }

    onClose() {
        let { contentEl } = this; // 获取模态框的内容元素
        contentEl.empty(); // 清空内容元素
    }
}

export { OpenFileModal, WarningModal, InputModal }; // 导出模态框类
