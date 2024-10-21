import {
    App,
    Notice,
    PluginSettingTab,
    Setting,
    Modal,
    moment,
    debounce,
    TFile,
} from "obsidian";

// import { WebDb } from "./db/web_db";
import { LocalDb } from "./db/local_db";
// import Server from "./api/server";
import LanguageLearner from "./plugin";
import { t } from "./lang/helper";
import { WarningModal, OpenFileModal } from "./modals";
import { dicts } from "@dict/list";
import store from "./store";

export interface MyPluginSettings {
    // use_server: boolean;
    // host: string,
    // port: number;
    // use_https: boolean;
    // api_key: string,
    // self_server: boolean;
    // self_port: number;
    // lang
    native: string;
    foreign: string;
    // search
    popup_search: boolean;
    auto_pron: boolean;
    function_key: "ctrlKey" | "altKey" | "metaKey" | "disable";
    dictionaries: { [K in string]: { enable: boolean; priority: number } };
    dict_height: string;
    // reading
    word_count: boolean;
    default_paragraphs: string;
    font_size: string;
    font_family: string;
    line_height: string;
    use_machine_trans: boolean;
    // indexed db
    db_name: string;
    // file db
    use_fileDB: boolean;
    word_folder: string;
    only_fileDB: boolean;
    // text db
    ignore_name: string;
    word_name: string;
    review_name: string;
    ignore_database: string;
    word_database: string;
    review_database: string;
    col_delimiter: "," | "\t" | "|";
    auto_refresh_db: boolean;
    // review
    review_prons: "0" | "1";
    review_delimiter: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
    // use_server: false,
    // port: 8086,
    // host: "127.0.0.1",
    // use_https: false,
    // api_key: "",
    // self_server: false,
    // self_port: 3002,
    // lang
    native: "zh",
    foreign: "en",
    // search
    popup_search: true,
    auto_pron: true,
    function_key: "ctrlKey",
    dictionaries: {
        youdao: { enable: true, priority: 1 },
        cambridge: { enable: true, priority: 2 },
        jukuu: { enable: true, priority: 3 },
        hjdict: { enable: true, priority: 4 },
        deepl: { enable: true, priority: 5 },
    },
    dict_height: "700px",
    // indexed
    db_name: "WordDB",
    // file db
    use_fileDB: true,
    word_folder: "WordDataBase",
    only_fileDB: false,
    // text db
    ignore_name: "Ignore",
    word_name: "WordDB",
    review_name: "ReviewDB",
    col_delimiter: ",",
    auto_refresh_db: true,
    // reading
    default_paragraphs: "1",
    font_size: "22px",
    font_family: '"Times New Roman"',
    line_height: "1.8em",
    use_machine_trans: true,
    word_count: true,
    // review
    review_prons: "0",
    review_delimiter: "?",
    ignore_database: "",
    word_database: "",
    review_database: "",
};

export class SettingTab extends PluginSettingTab {
    plugin: LanguageLearner;

    constructor(app: App, plugin: LanguageLearner) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        // 获取当前类的 containerEl 属性，它是一个 HTMLElement，用于承载设置界面的元素
        const { containerEl } = this;

        // 清空 containerEl 中的所有内容
        containerEl.empty();

        // 在 containerEl 中创建一个 h1 元素，并设置其文本内容为 "Settings for Language Learner"
        containerEl.createEl("h1", { text: "Settings for Language Learner" });

        // 调用 backendSettings 方法，将后端设置添加到 containerEl 中
        // this.backendSettings(containerEl);
        // 调用 langSettings 方法，将语言设置添加到 containerEl 中
        this.langSettings(containerEl);
        // 调用 querySettings 方法，将查询设置添加到 containerEl 中
        this.querySettings(containerEl);
        // 调用 indexedDBSettings 方法，将 IndexedDB 数据库设置添加到 containerEl 中
        this.indexedDBSettings(containerEl);
        // 调用 textDBSettings 方法，将文本数据库设置添加到 containerEl 中
        this.textDBSettings(containerEl);
        // 调用 readingSettings 方法，将阅读设置添加到 containerEl 中
        this.readingSettings(containerEl);
        // 调用 completionSettings 方法，将完成设置添加到 containerEl 中
        this.completionSettings(containerEl);
        // 调用 reviewSettings 方法，将复习设置添加到 containerEl 中
        this.reviewSettings(containerEl);
        // 调用 selfServerSettings 方法，将自服务器设置添加到 containerEl 中
        // this.selfServerSettings(containerEl);
    }
    /*
    backendSettings(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName(t("Use Server"))
            .setDesc(t("Use a seperated backend server"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.use_server)
                .onChange(async (use_server) => {
                    this.plugin.settings.use_server = use_server;
                    if (use_server) {
                        this.plugin.db.close();
                        this.plugin.db = new WebDb(
                            this.plugin.settings.host,
                            this.plugin.settings.port,
                            this.plugin.settings.use_https,
                            this.plugin.settings.api_key,
                        );
                    } else {
                        this.plugin.db = new LocalDb(this.plugin);
                        await this.plugin.db.open();
                    }
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        new Setting(containerEl)
            .setName(t("Use https"))
            .setDesc(t("Be sure your server enabled https"))
            .addToggle(toggle => toggle
                .setDisabled(this.plugin.settings.use_server)
                .setValue(this.plugin.settings.use_https)
                .onChange(async (use_https) => {
                    this.plugin.settings.use_https = use_https;
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        this.plugin.settings.use_https && new Setting(containerEl)
            .setName(t("Api Key"))
            .setDesc(
                t("Input your api-key for authentication")
            )
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.api_key)
                    .setDisabled(this.plugin.settings.use_server)
                    .onChange(debounce(async (api_key) => {
                        this.plugin.settings.api_key = api_key;
                        await this.plugin.saveSettings();
                        this.display();
                    }, 500, true))
            );

        new Setting(containerEl)
            .setName(t("Server Host"))
            .setDesc(
                t("Your server's host name (like 11.11.11.11 or baidu.com)")
            )
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.host)
                    .setDisabled(this.plugin.settings.use_server)
                    .onChange(debounce(async (host) => {
                        this.plugin.settings.host = host;
                        await this.plugin.saveSettings();
                    }, 500, true))
            );

        new Setting(containerEl)
            .setName(t("Server Port"))
            .setDesc(
                // t('An integer between 1024-65535. It should be same as "PORT" variable in .env file of server')
                t('It should be same as "PORT" variable in .env file of server')
            )
            .addText((text) =>
                text
                    .setDisabled(this.plugin.settings.use_server)
                    .setValue(String(this.plugin.settings.port))
                    .onChange(debounce(async (port) => {
                        let p = Number(port);
                        // if (!isNaN(p) && p >= 1023 && p <= 65535) {
                        if (!isNaN(p)) {
                            this.plugin.settings.port = p;
                            (this.plugin.db as WebDb).port = p;
                            await this.plugin.saveSettings();
                        } else {
                            new Notice(t("Wrong port format"));
                        }
                    }, 500, true))
            );
    }
    */

    langSettings(containerEl: HTMLElement) {
        containerEl.createEl("h2", { text: t("Language") });

        new Setting(containerEl).setName(t("Native")).addDropdown((native) =>
            native
                .addOption("zh", t("Chinese"))
                .setValue(this.plugin.settings.native)
                .onChange(async (value) => {
                    this.plugin.settings.native = value;
                    await this.plugin.saveSettings();
                    this.display();
                })
        );

        new Setting(containerEl).setName(t("Foreign")).addDropdown((foreign) =>
            foreign
                .addOption("en", t("English"))
                .addOption("jp", t("Japanese"))
                .addOption("kr", t("Korean"))
                .addOption("fr", t("French"))
                .addOption("de", t("Deutsch"))
                .addOption("es", t("Spanish"))
                .setValue(this.plugin.settings.foreign)
                .onChange(async (value) => {
                    this.plugin.settings.foreign = value;
                    await this.plugin.saveSettings();
                    this.display();
                })
        );
    }

    querySettings(containerEl: HTMLElement) {
        containerEl.createEl("h2", { text: t("Translate") });

        new Setting(containerEl)
            .setName(t("Popup Search Panel"))
            .setDesc(t("Use a popup search panel"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.popup_search)
                    .onChange(async (value) => {
                        this.plugin.settings.popup_search = value;
                        this.plugin.store.popupSearch = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("Auto pronounce"))
            .setDesc(t("Auto pronounce when searching"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.auto_pron)
                    .onChange(async (value) => {
                        this.plugin.settings.auto_pron = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("Word Select"))
            .setDesc(t("Press function key and select text to translate"))
            .addDropdown((funcKey) =>
                funcKey
                    .addOption("ctrlKey", "Ctrl")
                    .addOption("altKey", "Alt")
                    .addOption("metaKey", "Meta")
                    .addOption("disable", t("Disable"))
                    .setValue(this.plugin.settings.function_key)
                    .onChange(
                        async (
                            value: "ctrlKey" | "altKey" | "metaKey" | "disable"
                        ) => {
                            this.plugin.settings.function_key = value;
                            await this.plugin.saveSettings();
                        }
                    )
            );

        containerEl.createEl("h3", { text: t("Dictionaries") });

        let createDictSetting = (
            id: string,
            name: string,
            description: string
        ) => {
            new Setting(containerEl)
                .setName(name)
                .setDesc(description)
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.dictionaries[id].enable)
                        .onChange((value) => {
                            this.plugin.settings.dictionaries[id].enable =
                                value;
                            this.plugin.store.dictsChange =
                                !this.plugin.store.dictsChange;
                            this.plugin.saveSettings();
                        })
                )
                .addDropdown((num) =>
                    num
                        .addOption("1", "1")
                        .addOption("2", "2")
                        .addOption("3", "3")
                        .addOption("4", "4")
                        .addOption("5", "5")
                        .addOption("6", "6")
                        .addOption("7", "7")
                        .addOption("8", "8")
                        .addOption("9", "9")
                        .addOption("10", "10")
                        .setValue(
                            this.plugin.settings.dictionaries[
                                id
                            ].priority.toString()
                        )
                        .onChange(async (value: string) => {
                            this.plugin.settings.dictionaries[id].priority =
                                parseInt(value);
                            this.plugin.store.dictsChange =
                                !this.plugin.store.dictsChange;
                            await this.plugin.saveSettings();
                        })
                );
        };

        Object.keys(dicts).forEach((dict: keyof typeof dicts) => {
            createDictSetting(dict, dicts[dict].name, dicts[dict].description);
        });

        new Setting(containerEl)
            .setName(t("Dictionary Height"))
            .addText((text) =>
                text.setValue(this.plugin.settings.dict_height).onChange(
                    debounce(async (value) => {
                        this.plugin.settings.dict_height = value;
                        store.dictHeight = value;
                        await this.plugin.saveSettings();
                    }, 500)
                )
            );
    }

    //数据库设置
    indexedDBSettings(containerEl: HTMLElement) {
        containerEl.createEl("h2", { text: t("IndexDB Database") });

        new Setting(containerEl)
            .setName(t("Database Name"))
            .setDesc(t("Reopen DB after changing database name"))
            .addText((text) =>
                text.setValue(this.plugin.settings.db_name).onChange(
                    debounce(
                        async (name) => {
                            this.plugin.settings.db_name = name;
                            this.plugin.saveSettings();
                        },
                        1000,
                        true
                    )
                )
            )
            .addButton((button) =>
                button.setButtonText(t("Reopen")).onClick(async () => {
                    this.plugin.db.close();
                    this.plugin.db = new LocalDb(this.plugin);
                    await this.plugin.db.open();
                    new Notice("DB is Reopened");
                })
            );

        // 导入导出数据库
        new Setting(containerEl)
            .setName(t("Import & Export"))
            .setDesc(t("Warning: Import will override current database"))
            .addButton((button) =>
                button.setButtonText(t("Import")).onClick(async () => {
                    let modal = new OpenFileModal(
                        this.plugin.app,
                        async (file: File) => {
                            // let fr = new FileReader()
                            // fr.onload = async () => {
                            // let data = JSON.parse(fr.result as string)
                            await this.plugin.db.importDB(file);
                            new Notice("Imported");
                            // }
                            // fr.readAsText(file)
                        }
                    );
                    modal.open();
                })
            )
            .addButton((button) =>
                button.setButtonText(t("Export")).onClick(async () => {
                    await this.plugin.db.exportDB();
                    new Notice("Exported");
                })
            );
        // 获取所有非无视单词
        new Setting(containerEl)
            .setName(t("Get all non-ignores"))
            .addButton((button) =>
                button.setButtonText(t("Export Word")).onClick(async () => {
                    let words = await this.plugin.db.getAllExpressionSimple(
                        true
                    );
                    let ignores = words
                        .filter((w) => w.status !== 0 && w.t !== "PHRASE")
                        .map((w) => w.expression);
                    await navigator.clipboard.writeText(ignores.join("\n"));
                    new Notice(t("Copied to clipboard"));
                })
            )
            .addButton((button) =>
                button
                    .setButtonText(t("Export Word and Phrase"))
                    .onClick(async () => {
                        let words = await this.plugin.db.getAllExpressionSimple(
                            true
                        );
                        let ignores = words
                            .filter((w) => w.status !== 0)
                            .map((w) => w.expression);
                        await navigator.clipboard.writeText(ignores.join("\n"));
                        new Notice(t("Copied to clipboard"));
                    })
            );

        // 获取所有无视单词
        // 这一行是注释，说明接下来的代码块的目的是处理与“获取所有无视单词”相关的功能。

        new Setting(containerEl)
            .setName(t("Get all ignores"))
            // 创建一个新的设置项，并将其添加到 containerEl 容器中。
            // setName 方法用于设置此设置项的名称，t("Get all ignores") 表示使用翻译函数翻译文本。

            .addButton((button) =>
                // 向设置项添加一个按钮。
                button.setButtonText(t("Export")).onClick(async () => {
                    // 设置按钮的文本为“Export”（导出），并为其绑定一个点击事件处理函数。
                    // 点击事件处理函数是异步的，用于处理导出逻辑。

                    let words = await this.plugin.db.getAllExpressionSimple(
                        true
                    );
                    // 从数据库中异步获取所有单词的简略信息，其中 true 表示只获取被标记为忽略的单词。

                    let ignores = words
                        .filter((w) => w.status === 0)
                        .map((w) => w.expression);
                    // 从获取到的单词中过滤出状态为 0（忽略）的单词，并将它们映射为一个只包含表达式的数组。
                    let filePath = `${this.plugin.settings.word_folder}/data/${this.plugin.settings.ignore_name}.md`;
                    // 构建文件的完整路径

                    // 检查文件是否存在，如果不存在则创建文件
                    let file = this.app.vault.getAbstractFileByPath(filePath);
                    if (!file) {
                        // 文件不存在，创建新文件
                        this.app.vault.create(filePath, ""); // 创建空文件
                    }
                    let fileContent = ignores.join("\n") ;
                    // 异步写入文件
                    await this.app.vault.modify(
                        this.app.vault.getAbstractFileByPath(filePath) as TFile,
                        fileContent 
                    );

                    new Notice(
                        t("Words have been written to file!")
                    );

                })
            );

        // 销毁数据库
        new Setting(containerEl)
            .setName(t("Destroy Database"))
            .setDesc(t("Destroy all stuff and start over"))
            .addButton((button) =>
                button
                    .setButtonText(t("Destroy"))
                    .setWarning()
                    .onClick(async (evt) => {
                        let modal = new WarningModal(
                            this.app,
                            t(
                                "Are you sure you want to destroy your database?"
                            ),
                            async () => {
                                await this.plugin.db.destroyAll();
                                new Notice("已清空");
                                this.plugin.db = new LocalDb(this.plugin);
                                this.plugin.db.open();
                            }
                        );
                        modal.open();
                    })
            );
    }

    textDBSettings(containerEl: HTMLElement) {
        containerEl.createEl("h3", { text: t("Text Database") });

        new Setting(containerEl)
            .setName(t("Auto refresh"))
            .setDesc(t("Auto refresh database when submitting"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.auto_refresh_db)
                    .onChange(async (value) => {
                        this.plugin.settings.auto_refresh_db = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("Word Database Path"))
            .setDesc(t("Choose a md file as word database for auto-completion"))
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.word_database)
                    .onChange(async (path) => {
                        this.plugin.settings.word_database = path;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("Review Database Path"))
            .setDesc(
                t("Choose a md file as review database for spaced-repetition")
            )
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.review_database)
                    .onChange(async (path) => {
                        this.plugin.settings.review_database = path;
                        await this.plugin.saveSettings();
                    })
            );
    }

    readingSettings(containerEl: HTMLElement) {
        containerEl.createEl("h3", { text: t("Reading Mode") });

        new Setting(containerEl)
            .setName(t("Font Size"))
            .setDesc(t("Like 15px or 1.5em"))
            .addText((text) =>
                text.setValue(this.plugin.settings.font_size).onChange(
                    debounce(async (value) => {
                        this.plugin.settings.font_size = value;
                        this.plugin.store.fontSize = value;
                        await this.plugin.saveSettings();
                    }, 500)
                )
            );

        new Setting(containerEl).setName(t("Font Family")).addText((text) =>
            text.setValue(this.plugin.settings.font_family).onChange(
                debounce(async (value) => {
                    this.plugin.settings.font_family = value;
                    this.plugin.store.fontFamily = value;
                    await this.plugin.saveSettings();
                }, 500)
            )
        );

        new Setting(containerEl).setName(t("Line Height")).addText((text) =>
            text.setValue(this.plugin.settings.line_height).onChange(
                debounce(async (value) => {
                    this.plugin.settings.line_height = value;
                    this.plugin.store.lineHeight = value;
                    await this.plugin.saveSettings();
                }, 500)
            )
        );

        new Setting(containerEl)
            .setName(t("Default Paragraphs"))
            .addDropdown((num) =>
                num
                    .addOption("2", "1")
                    .addOption("4", "2")
                    .addOption("8", "4")
                    .addOption("16", "8")
                    .addOption("32", "16")
                    .addOption("all", "All")
                    .setValue(this.plugin.settings.default_paragraphs)
                    .onChange(async (value: string) => {
                        this.plugin.settings.default_paragraphs = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName(t("Use Machine Translation"))
            .setDesc(t("Auto translate sentences"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.use_machine_trans)
                    .onChange(async (use_machine_trans) => {
                        this.plugin.settings.use_machine_trans =
                            use_machine_trans;
                        await this.plugin.saveSettings();
                    })
            );
        new Setting(containerEl)
            .setName(t("Open count bar"))
            .setDesc(t("Count the word number of different type of article"))
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.word_count)
                    .onChange(async (value) => {
                        this.plugin.settings.word_count = value;
                        await this.plugin.saveSettings();
                    })
            );
    }

    completionSettings(containerEl: HTMLElement) {
        containerEl.createEl("h3", { text: t("Auto Completion") });

        new Setting(containerEl)
            .setName(t("Column delimiter"))
            .addDropdown((dilimiter) =>
                dilimiter
                    .addOption(",", t("Comma"))
                    .addOption("\t", t("Tab"))
                    .addOption("|", t("Pipe"))
                    .setValue(this.plugin.settings.col_delimiter)
                    .onChange(async (value: "," | "\t" | "|") => {
                        this.plugin.settings.col_delimiter = value;
                        await this.plugin.saveSettings();
                    })
            );
    }

    reviewSettings(containerEl: HTMLElement) {
        containerEl.createEl("h3", { text: t("Review") });

        new Setting(containerEl)
            .setName(t("Accent"))
            .setDesc(t("Choose your preferred accent"))
            .addDropdown((accent) =>
                accent
                    .addOption("0", t("American"))
                    .addOption("1", t("British"))
                    .setValue(this.plugin.settings.review_prons)
                    .onChange(async (value: "0" | "1") => {
                        this.plugin.settings.review_prons = value;
                        await this.plugin.saveSettings();
                    })
            );
        new Setting(containerEl).setName(t("Delimiter")).addText((text) =>
            text
                .setValue(this.plugin.settings.review_delimiter)
                .onChange(async (value) => {
                    this.plugin.settings.review_delimiter = value;
                    await this.plugin.saveSettings();
                })
        );
    }

    // selfServerSettings(containerEl: HTMLElement) {
    //     containerEl.createEl("h3", { text: t("As Server") });

    //     new Setting(containerEl)
    //         .setName(t("Self as Server"))
    //         .setDesc(
    //             t("Make plugin a server and interact with chrome extension")
    //         )
    //         .addToggle((toggle) =>
    //             toggle
    //                 .setValue(this.plugin.settings.self_server)
    //                 .onChange(async (self_server) => {
    //                     this.plugin.settings.self_server = self_server;
    //                     if (self_server) {
    //                         this.plugin.server = new Server(
    //                             this.plugin,
    //                             this.plugin.settings.self_port
    //                         );
    //                         await this.plugin.server.start();
    //                     } else {
    //                         await this.plugin.server?.close();
    //                         this.plugin.server = null;
    //                     }
    //                     await this.plugin.saveSettings();
    //                     this.display();
    //                 })
    //         );

    //     new Setting(containerEl)
    //         .setName(t("Server Port"))
    //         .setDesc(t("when changing port, you should restart the server"))
    //         .addText((text) =>
    //             text.setValue(String(this.plugin.settings.self_port)).onChange(
    //                 debounce(
    //                     async (port) => {
    //                         let p = Number(port);
    //                         if (!isNaN(p) && p >= 1023 && p <= 65535) {
    //                             this.plugin.settings.self_port = p;
    //                             await this.plugin.saveSettings();
    //                         } else {
    //                             new Notice(t("Wrong port format"));
    //                         }
    //                     },
    //                     1000,
    //                     true
    //                 )
    //             )
    //         );
    // }
}
