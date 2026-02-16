/**
 * 株価データ更新スクリプト
 * サーバー起動時または手動実行で、Yahoo Financeから最新データを取得してキャッシュする
 */

import fs from "fs";
import path from "path";

interface StockPrice {
    symbol: string;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface Stock {
    symbol: string;
    name: string;
    sector: string;
    description?: string;
    marketCapEstimate?: string;
}

const POPULAR_STOCKS = [
    // 既存の主要10銘柄
    {
        symbol: "7203",
        name: "トヨタ自動車",
        sector: "自動車",
        description:
            "世界最大級の自動車メーカー。ハイブリッド車で先駆的。トヨタ生産方式で製造業に大きな影響",
        marketCapEstimate: "約45兆円",
    },
    {
        symbol: "9984",
        name: "ソフトバンクグループ",
        sector: "IT・通信",
        description:
            "ビジョンファンドによる世界的な投資活動。アリババ、ARM等に投資",
        marketCapEstimate: "約12兆円",
    },
    {
        symbol: "6758",
        name: "ソニーグループ",
        sector: "電機",
        description:
            "エレクトロニクス、ゲーム(PlayStation)、映画・音楽事業を展開する総合エンターテイメント企業",
        marketCapEstimate: "約18兆円",
    },
    {
        symbol: "9983",
        name: "ファーストリテイリング",
        sector: "小売",
        description:
            "ユニクロを中核とする世界的なアパレル小売企業。機能性カジュアル衣料で独自ポジション",
        marketCapEstimate: "約12兆円",
    },
    {
        symbol: "7974",
        name: "任天堂",
        sector: "ゲーム",
        description:
            "マリオ、ゼルダ等の人気IPを持つゲーム会社。Nintendo Switchで大成功",
        marketCapEstimate: "約10兆円",
    },
    {
        symbol: "6861",
        name: "キーエンス",
        sector: "電機",
        description:
            "FAセンサー・測定器のトップメーカー。高収益率で社員の平均年収が日本一と言われる",
        marketCapEstimate: "約22兆円",
    },
    {
        symbol: "4063",
        name: "信越化学工業",
        sector: "化学",
        description:
            "塩化ビニル樹脂・半導体シリコンで世界トップシェア。高収益・高配当が特徴",
        marketCapEstimate: "約10兆円",
    },
    {
        symbol: "6098",
        name: "リクルートホールディングス",
        sector: "サービス",
        description:
            "人材派遣・求人サイト大手。Indeed等のグローバルHRテック事業を展開",
        marketCapEstimate: "約13兆円",
    },
    {
        symbol: "9434",
        name: "ソフトバンク",
        sector: "IT・通信",
        description: "国内通信事業の中核企業。5G・IoT・AI領域に注力",
        marketCapEstimate: "約7兆円",
    },
    {
        symbol: "4502",
        name: "武田薬品工業",
        sector: "医薬品",
        description: "日本最大の製薬会社。シャイアー買収で世界トップ10入り",
        marketCapEstimate: "約7兆円",
    },

    // 金融（7銘柄）
    {
        symbol: "8306",
        name: "三菱UFJフィナンシャル・グループ",
        sector: "金融",
        description: "国内最大の金融グループ。銀行・証券・信託を展開",
        marketCapEstimate: "約17兆円",
    },
    {
        symbol: "8316",
        name: "三井住友フィナンシャルグループ",
        sector: "金融",
        description: "三井住友銀行を中核とする総合金融グループ",
        marketCapEstimate: "約10兆円",
    },
    {
        symbol: "8411",
        name: "みずほフィナンシャルグループ",
        sector: "金融",
        description: "みずほ銀行を中核とするメガバンクグループ",
        marketCapEstimate: "約6兆円",
    },
    {
        symbol: "8601",
        name: "大和証券グループ本社",
        sector: "金融",
        description: "国内証券最大手。個人・法人向け金融サービス",
        marketCapEstimate: "約1.5兆円",
    },
    {
        symbol: "8604",
        name: "野村ホールディングス",
        sector: "金融",
        description: "証券大手。海外展開にも積極的",
        marketCapEstimate: "約2兆円",
    },
    {
        symbol: "8766",
        name: "東京海上ホールディングス",
        sector: "金融",
        description: "国内損保最大手。海外保険事業も拡大",
        marketCapEstimate: "約8兆円",
    },
    {
        symbol: "8725",
        name: "MS&ADインシュアランスグループHD",
        sector: "金融",
        description:
            "三井住友海上・あいおいニッセイ同和を傘下に持つ損保グループ",
        marketCapEstimate: "約5兆円",
    },

    // 自動車・輸送機器（6銘柄）
    {
        symbol: "7267",
        name: "ホンダ",
        sector: "自動車",
        description: "二輪車で世界トップシェア。四輪車・航空機事業も展開",
        marketCapEstimate: "約8兆円",
    },
    {
        symbol: "7201",
        name: "日産自動車",
        sector: "自動車",
        description: "国内3位の自動車メーカー。電気自動車(EV)に注力",
        marketCapEstimate: "約2兆円",
    },
    {
        symbol: "7261",
        name: "マツダ",
        sector: "自動車",
        description: "ロータリーエンジン・クリーンディーゼルで独自技術",
        marketCapEstimate: "約1兆円",
    },
    {
        symbol: "7269",
        name: "スズキ",
        sector: "自動車",
        description: "軽自動車・小型車に強み。インド市場でトップシェア",
        marketCapEstimate: "約4兆円",
    },
    {
        symbol: "6902",
        name: "デンソー",
        sector: "自動車部品",
        description: "トヨタ系自動車部品メーカー世界大手。電動化技術に注力",
        marketCapEstimate: "約6兆円",
    },
    {
        symbol: "5108",
        name: "ブリヂストン",
        sector: "自動車部品",
        description: "タイヤ世界最大手。高機能タイヤで差別化",
        marketCapEstimate: "約4兆円",
    },

    // 電機（8銘柄）
    {
        symbol: "6752",
        name: "パナソニックホールディングス",
        sector: "電機",
        description: "総合電機大手。家電・車載電池・住宅設備を展開",
        marketCapEstimate: "約3兆円",
    },
    {
        symbol: "6501",
        name: "日立製作所",
        sector: "電機",
        description: "総合電機最大手。社会インフラ・ITに注力",
        marketCapEstimate: "約8兆円",
    },
    {
        symbol: "6503",
        name: "三菱電機",
        sector: "電機",
        description: "総合電機。重電・FAシステム・人工衛星まで幅広い",
        marketCapEstimate: "約4兆円",
    },
    {
        symbol: "6702",
        name: "富士通",
        sector: "電機",
        description: "国内IT最大手。DXソリューション・クラウドサービス",
        marketCapEstimate: "約3兆円",
    },
    {
        symbol: "6971",
        name: "京セラ",
        sector: "電機",
        description: "セラミック技術を基盤に電子部品・通信機器を展開",
        marketCapEstimate: "約3兆円",
    },
    {
        symbol: "6954",
        name: "ファナック",
        sector: "電機",
        description: "工作機械用CNC・産業ロボットで世界トップシェア",
        marketCapEstimate: "約7兆円",
    },
    {
        symbol: "6981",
        name: "村田製作所",
        sector: "電機",
        description: "積層セラミックコンデンサで世界トップシェア",
        marketCapEstimate: "約6兆円",
    },
    {
        symbol: "6762",
        name: "TDK",
        sector: "電機",
        description: "磁性材料・電子部品大手。HDD用磁気ヘッドで高シェア",
        marketCapEstimate: "約2兆円",
    },

    // 通信（2銘柄）
    {
        symbol: "9432",
        name: "日本電信電話",
        sector: "IT・通信",
        description: "NTTグループの持株会社。通信インフラ・データセンター",
        marketCapEstimate: "約20兆円",
    },
    {
        symbol: "9433",
        name: "KDDI",
        sector: "IT・通信",
        description: "au通信事業を展開。金融・エネルギー事業も",
        marketCapEstimate: "約10兆円",
    },

    // 小売（3銘柄）
    {
        symbol: "3382",
        name: "セブン&アイ・ホールディングス",
        sector: "小売",
        description: "セブンイレブン・イトーヨーカ堂を展開する小売最大手",
        marketCapEstimate: "約4兆円",
    },
    {
        symbol: "8267",
        name: "イオン",
        sector: "小売",
        description: "国内最大の総合小売グループ。ショッピングモール展開",
        marketCapEstimate: "約3兆円",
    },
    {
        symbol: "4755",
        name: "楽天グループ",
        sector: "IT・通信",
        description: "EC・金融・通信など多角的事業。楽天市場が中核",
        marketCapEstimate: "約1兆円",
    },

    // 食品（3銘柄）
    {
        symbol: "2502",
        name: "アサヒグループホールディングス",
        sector: "食品",
        description: "ビール・飲料大手。スーパードライで有名",
        marketCapEstimate: "約2兆円",
    },
    {
        symbol: "2503",
        name: "キリンホールディングス",
        sector: "食品",
        description: "ビール・飲料・医薬品を展開する総合食品メーカー",
        marketCapEstimate: "約2兆円",
    },
    {
        symbol: "2802",
        name: "味の素",
        sector: "食品",
        description: "アミノ酸技術を基盤に調味料・加工食品を展開",
        marketCapEstimate: "約2.5兆円",
    },

    // 医薬品（3銘柄）
    {
        symbol: "4568",
        name: "第一三共",
        sector: "医薬品",
        description: "抗がん剤ADC技術で世界的に注目される製薬大手",
        marketCapEstimate: "約12兆円",
    },
    {
        symbol: "4523",
        name: "エーザイ",
        sector: "医薬品",
        description: "アルツハイマー型認知症治療薬で世界をリード",
        marketCapEstimate: "約6兆円",
    },
    {
        symbol: "4503",
        name: "アステラス製薬",
        sector: "医薬品",
        description: "泌尿器・移植・がん領域に強みを持つ製薬企業",
        marketCapEstimate: "約4兆円",
    },

    // 化学（3銘柄）
    {
        symbol: "4188",
        name: "三菱ケミカルグループ",
        sector: "化学",
        description: "総合化学メーカー。炭素繊維・機能性化学品に強み",
        marketCapEstimate: "約1.5兆円",
    },
    {
        symbol: "4452",
        name: "花王",
        sector: "化学",
        description: "洗剤・化粧品・ヘルスケア製品の大手メーカー。高収益が特徴",
        marketCapEstimate: "約3兆円",
    },
    {
        symbol: "4901",
        name: "富士フイルムホールディングス",
        sector: "化学",
        description:
            "写真フィルムで培った技術を活用し、医療機器、化粧品、印刷機器など幅広い事業を展開。ヘルスケア・メディカル分野に注力",
        marketCapEstimate: "約3.5兆円",
    },

    // 商社（5銘柄）
    {
        symbol: "8058",
        name: "三菱商事",
        sector: "商社",
        description: "総合商社最大手。資源・エネルギー・食品など幅広い事業",
        marketCapEstimate: "約12兆円",
    },
    {
        symbol: "8031",
        name: "三井物産",
        sector: "商社",
        description: "総合商社大手。金属・エネルギー・化学品が主力",
        marketCapEstimate: "約9兆円",
    },
    {
        symbol: "8001",
        name: "伊藤忠商事",
        sector: "商社",
        description: "非資源に強い総合商社。繊維・食料が伝統的に強い",
        marketCapEstimate: "約10兆円",
    },
    {
        symbol: "8053",
        name: "住友商事",
        sector: "商社",
        description: "総合商社大手。メディア・インフラ事業に注力",
        marketCapEstimate: "約5兆円",
    },
    {
        symbol: "8002",
        name: "丸紅",
        sector: "商社",
        description: "総合商社大手。穀物・電力・不動産が主力",
        marketCapEstimate: "約4兆円",
    },

    // 不動産（1銘柄）
    {
        symbol: "8801",
        name: "三井不動産",
        sector: "不動産",
        description: "オフィスビル・商業施設開発大手。日本橋再開発を推進",
        marketCapEstimate: "約7兆円",
    },

    // 追加: 鉄鋼・非鉄金属（10銘柄）
    { symbol: "5401", name: "日本製鉄", sector: "鉄鋼" },
    { symbol: "5406", name: "神戸製鋼所", sector: "鉄鋼" },
    { symbol: "5411", name: "JFEホールディングス", sector: "鉄鋼" },
    { symbol: "5713", name: "住友金属鉱山", sector: "非鉄金属" },
    { symbol: "5711", name: "三菱マテリアル", sector: "非鉄金属" },
    { symbol: "5801", name: "古河電気工業", sector: "非鉄金属" },
    { symbol: "5802", name: "住友電気工業", sector: "非鉄金属" },
    { symbol: "3402", name: "東レ", sector: "繊維" },
    { symbol: "3861", name: "王子ホールディングス", sector: "紙パルプ" },
    { symbol: "3401", name: "帝人", sector: "繊維" },

    // 追加: エネルギー・資源（10銘柄）
    { symbol: "5020", name: "ENEOSホールディングス", sector: "エネルギー" },
    { symbol: "5019", name: "出光興産", sector: "エネルギー" },
    { symbol: "1605", name: "国際石油開発帝石", sector: "資源開発" },
    { symbol: "1963", name: "日揮ホールディングス", sector: "建設" },
    { symbol: "9501", name: "東京電力ホールディングス", sector: "電力" },
    { symbol: "9502", name: "中部電力", sector: "電力" },
    { symbol: "9503", name: "関西電力", sector: "電力" },
    { symbol: "9531", name: "東京ガス", sector: "ガス" },
    { symbol: "9532", name: "大阪ガス", sector: "ガス" },
    { symbol: "9007", name: "小田急電鉄", sector: "鉄道" },

    // 追加: 建設・不動産（15銘柄）
    { symbol: "1925", name: "大和ハウス工業", sector: "建設" },
    { symbol: "1928", name: "積水ハウス", sector: "建設" },
    { symbol: "1802", name: "大林組", sector: "建設" },
    { symbol: "1803", name: "清水建設", sector: "建設" },
    { symbol: "1812", name: "鹿島建設", sector: "建設" },
    { symbol: "1801", name: "大成建設", sector: "建設" },
    { symbol: "8802", name: "三菱地所", sector: "不動産" },
    { symbol: "8830", name: "住友不動産", sector: "不動産" },
    { symbol: "3289", name: "東急不動産ホールディングス", sector: "不動産" },
    { symbol: "2269", name: "明治ホールディングス", sector: "食品" },
    { symbol: "2282", name: "日本ハム", sector: "食品" },
    { symbol: "2914", name: "日本たばこ産業", sector: "食品" },
    { symbol: "2871", name: "ニチレイ", sector: "食品" },
    { symbol: "2501", name: "サッポロホールディングス", sector: "食品" },
    { symbol: "2801", name: "キッコーマン", sector: "食品" },

    // 追加: IT・半導体（20銘柄）
    { symbol: "6920", name: "レーザーテック", sector: "半導体製造装置" },
    { symbol: "8035", name: "東京エレクトロン", sector: "半導体製造装置" },
    { symbol: "6857", name: "アドバンテスト", sector: "半導体検査装置" },
    { symbol: "4704", name: "トレンドマイクロ", sector: "ソフトウェア" },
    { symbol: "9613", name: "エヌ・ティ・ティ・データ", sector: "IT" },
    { symbol: "4689", name: "Zホールディングス", sector: "IT" },
    { symbol: "3659", name: "ネクソン", sector: "ゲーム" },
    { symbol: "3774", name: "インターネットイニシアティブ", sector: "IT" },
    { symbol: "4751", name: "サイバーエージェント", sector: "IT" },
    { symbol: "2413", name: "エムスリー", sector: "IT" },
    { symbol: "4324", name: "電通グループ", sector: "広告" },
    { symbol: "4307", name: "野村総合研究所", sector: "IT" },
    { symbol: "9735", name: "セコム", sector: "サービス" },
    { symbol: "2181", name: "パーソルホールディングス", sector: "サービス" },
    { symbol: "9766", name: "コナミグループ", sector: "ゲーム" },
    {
        symbol: "7832",
        name: "バンダイナムコホールディングス",
        sector: "ゲーム",
    },
    { symbol: "4911", name: "資生堂", sector: "化粧品" },
    { symbol: "7453", name: "良品計画", sector: "小売" },
    { symbol: "3099", name: "三越伊勢丹ホールディングス", sector: "小売" },
    { symbol: "8233", name: "高島屋", sector: "小売" },

    // 追加: 精密機器・その他製造（20銘柄）
    {
        symbol: "7733",
        name: "オリンパス",
        sector: "精密機器",
        description:
            "内視鏡で世界トップシェア。医療事業に特化した精密機器メーカー",
        marketCapEstimate: "約5兆円",
    },
    {
        symbol: "7741",
        name: "HOYA",
        sector: "精密機器",
        description:
            "半導体マスクブランクス・医療用レンズで世界トップシェア。高収益企業として知られる",
        marketCapEstimate: "約6兆円",
    },
    {
        symbol: "7731",
        name: "ニコン",
        sector: "精密機器",
        description: "カメラ・半導体露光装置を展開。光学技術に強み",
        marketCapEstimate: "約6000億円",
    },
    {
        symbol: "7751",
        name: "キヤノン",
        sector: "精密機器",
        description: "カメラ・プリンター・半導体露光装置の総合精密機器メーカー",
        marketCapEstimate: "約5兆円",
    },
    {
        symbol: "7752",
        name: "リコー",
        sector: "精密機器",
        description:
            "複合機・プリンターの大手。オフィスソリューション事業を展開",
        marketCapEstimate: "約8000億円",
    },
    { symbol: "6503", name: "セイコーエプソン", sector: "精密機器" },
    { symbol: "4151", name: "協和キリン", sector: "医薬品" },
    { symbol: "4519", name: "中外製薬", sector: "医薬品" },
    { symbol: "4901", name: "富士フイルムホールディングス", sector: "化学" },
    { symbol: "4061", name: "デンカ", sector: "化学" },
    { symbol: "4005", name: "住友化学", sector: "化学" },
    { symbol: "4042", name: "東ソー", sector: "化学" },
    { symbol: "4208", name: "宇部興産", sector: "化学" },
    { symbol: "4183", name: "三井化学", sector: "化学" },
    { symbol: "7011", name: "三菱重工業", sector: "機械" },
    { symbol: "6301", name: "コマツ", sector: "機械" },
    { symbol: "6305", name: "日立建機", sector: "機械" },
    { symbol: "6326", name: "クボタ", sector: "機械" },
    { symbol: "7012", name: "川崎重工業", sector: "機械" },
    { symbol: "6367", name: "ダイキン工業", sector: "機械" },

    // 追加: 運輸・物流（15銘柄）
    { symbol: "9020", name: "東日本旅客鉄道", sector: "鉄道" },
    { symbol: "9022", name: "東海旅客鉄道", sector: "鉄道" },
    { symbol: "9021", name: "西日本旅客鉄道", sector: "鉄道" },
    { symbol: "9009", name: "京成電鉄", sector: "鉄道" },
    { symbol: "9005", name: "東京急行電鉄", sector: "鉄道" },
    { symbol: "9202", name: "ANAホールディングス", sector: "空運" },
    { symbol: "9201", name: "日本航空", sector: "空運" },
    { symbol: "9101", name: "日本郵船", sector: "海運" },
    { symbol: "9104", name: "商船三井", sector: "海運" },
    { symbol: "9107", name: "川崎汽船", sector: "海運" },
    { symbol: "9064", name: "ヤマトホールディングス", sector: "物流" },
    { symbol: "9062", name: "日本通運", sector: "物流" },
    { symbol: "9301", name: "三菱倉庫", sector: "倉庫" },
    { symbol: "9302", name: "三井倉庫ホールディングス", sector: "倉庫" },
    { symbol: "4543", name: "テルモ", sector: "医療機器" },

    // 追加: サービス・娯楽（25銘柄）
    { symbol: "9602", name: "東宝", sector: "娯楽" },
    { symbol: "9601", name: "松竹", sector: "娯楽" },
    { symbol: "4751", name: "サイバーエージェント", sector: "IT" },
    { symbol: "2432", name: "ディー・エヌ・エー", sector: "IT" },
    { symbol: "3092", name: "ZOZO", sector: "小売" },
    { symbol: "7581", name: "サイゼリヤ", sector: "外食" },
    { symbol: "9983", name: "すかいらーくホールディングス", sector: "外食" },
    { symbol: "7616", name: "コロワイド", sector: "外食" },
    { symbol: "3086", name: "Jフロント リテイリング", sector: "小売" },
    { symbol: "8252", name: "丸井グループ", sector: "小売" },
    { symbol: "7412", name: "アトム", sector: "外食" },
    { symbol: "8591", name: "オリックス", sector: "金融" },
    {
        symbol: "7186",
        name: "コンコルディア・フィナンシャルグループ",
        sector: "金融",
    },
    {
        symbol: "8309",
        name: "三井住友トラスト・ホールディングス",
        sector: "金融",
    },
    { symbol: "7182", name: "ゆうちょ銀行", sector: "金融" },
    { symbol: "7167", name: "めぶきフィナンシャルグループ", sector: "金融" },
    { symbol: "8308", name: "りそなホールディングス", sector: "金融" },
    { symbol: "8473", name: "SBIホールディングス", sector: "金融" },
    { symbol: "8750", name: "第一生命ホールディングス", sector: "金融" },
    { symbol: "8630", name: "SOMPOホールディングス", sector: "金融" },
    { symbol: "1333", name: "マルハニチロ", sector: "食品" },
    { symbol: "2810", name: "ハウス食品グループ本社", sector: "食品" },
    {
        symbol: "2588",
        name: "プレミアムウォーターホールディングス",
        sector: "食品",
    },
    { symbol: "7419", name: "ノジマ", sector: "小売" },
    { symbol: "8252", name: "ビックカメラ", sector: "小売" },
];

async function downloadStockData(
    symbol: string,
    startDate: string,
    endDate: string,
): Promise<StockPrice[]> {
    const period1 = Math.floor(new Date(startDate).getTime() / 1000);
    const period2 = Math.floor(new Date(endDate).getTime() / 1000);

    // Yahoo Finance v7 APIを使用（v7は認証不要）
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}.T?period1=${period1}&period2=${period2}&interval=1d&events=history`;

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
        });

        if (!response.ok) {
            console.error(`${symbol}: HTTP ${response.status}`);
            return [];
        }

        const data = await response.json();
        const result = data?.chart?.result?.[0];

        if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
            console.error(`${symbol}: データ構造が不正`);
            return [];
        }

        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        const prices: StockPrice[] = [];

        for (let i = 0; i < timestamps.length; i++) {
            const date = new Date(timestamps[i] * 1000)
                .toISOString()
                .split("T")[0];
            const open = quote.open[i];
            const high = quote.high[i];
            const low = quote.low[i];
            const close = quote.close[i];
            const volume = quote.volume[i];

            if (open && high && low && close && volume) {
                prices.push({
                    symbol,
                    date,
                    open,
                    high,
                    low,
                    close,
                    volume,
                });
            }
        }

        return prices;
    } catch (error) {
        console.error(`${symbol}: ダウンロードエラー`, error);
        return [];
    }
}

async function fetchCompanyInfo(symbol: string): Promise<Partial<Stock>> {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}.T?modules=assetProfile,summaryDetail,defaultKeyStatistics`;

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
        });

        if (!response.ok) {
            return {};
        }

        const data = await response.json();
        const result = data?.quoteSummary?.result?.[0];

        if (!result) {
            return {};
        }

        const profile = result.assetProfile || {};
        const summaryDetail = result.summaryDetail || {};
        const keyStats = result.defaultKeyStatistics || {};

        return {
            description: profile.longBusinessSummary,
        };
    } catch (error) {
        console.error(`${symbol}: 企業情報取得エラー`, error);
        return {};
    }
}

async function updateAllStockData() {
    console.log("📊 株価データ更新を開始...");

    const startDate = "2015-01-01";
    const endDate = new Date().toISOString().split("T")[0];

    const allStocks: Stock[] = [];
    const allPrices: StockPrice[] = [];

    // 全銘柄をダウンロード
    const stocksToDownload = POPULAR_STOCKS;

    for (let i = 0; i < stocksToDownload.length; i++) {
        const stock = stocksToDownload[i];
        console.log(
            `[${i + 1}/${stocksToDownload.length}] ${stock.name} (${stock.symbol}) をダウンロード中...`,
        );

        const prices = await downloadStockData(
            stock.symbol,
            startDate,
            endDate,
        );

        if (prices.length > 0) {
            // 企業情報はセッション開始時に取得するため、ここでは基本情報のみ保存
            allStocks.push(stock);
            allPrices.push(...prices);
            console.log(`  ✓ ${prices.length}件取得完了`);
        } else {
            console.log(`  ✗ データ取得失敗`);
        }

        // レート制限対策
        if (i < stocksToDownload.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    // データをファイルに保存
    const dataDir = path.join(process.cwd(), "lib", "data", "cache");
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const stocksPath = path.join(dataDir, "stocks.json");
    const pricesPath = path.join(dataDir, "prices.json");
    const metaPath = path.join(dataDir, "meta.json");

    fs.writeFileSync(stocksPath, JSON.stringify(allStocks, null, 2));
    fs.writeFileSync(pricesPath, JSON.stringify(allPrices, null, 2));
    fs.writeFileSync(
        metaPath,
        JSON.stringify(
            {
                lastUpdated: new Date().toISOString(),
                stockCount: allStocks.length,
                priceCount: allPrices.length,
                dateRange: { start: startDate, end: endDate },
            },
            null,
            2,
        ),
    );

    console.log("\n✅ 更新完了！");
    console.log(`   銘柄数: ${allStocks.length}`);
    console.log(`   価格データ: ${allPrices.length}件`);
    console.log(`   保存先: ${dataDir}`);
}

// スクリプトとして実行された場合
if (require.main === module) {
    updateAllStockData()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ エラーが発生しました:", error);
            process.exit(1);
        });
}

export { updateAllStockData };
