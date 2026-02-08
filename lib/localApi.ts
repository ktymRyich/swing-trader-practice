import { db, Session, Stock, StockPrice } from "@/lib/db/schema";

type StockCache = {
    stocks: Stock[];
    prices: StockPrice[];
    meta: any | null;
};

let stockCachePromise: Promise<StockCache> | null = null;

const tryFetchJson = async (url: string) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch {
        return null;
    }
};

const loadStockCache = async (): Promise<StockCache> => {
    if (!stockCachePromise) {
        stockCachePromise = (async () => {
            const stocks = await tryFetchJson("/cache/stocks.json");
            const prices = await tryFetchJson("/cache/prices.json");
            const meta = await tryFetchJson("/cache/meta.json");

            if (stocks && prices) {
                return { stocks, prices, meta };
            }

            const apiData = await tryFetchJson("/api/stocks/cached");
            if (apiData?.success) {
                return {
                    stocks: apiData.stocks || [],
                    prices: apiData.prices || [],
                    meta: apiData.meta || null,
                };
            }

            throw new Error("株価データが見つかりません");
        })();
    }

    return stockCachePromise;
};

export const login = async (nickname: string) => {
    const trimmed = nickname.trim();
    if (!trimmed) {
        return { success: false, error: "ニックネームを入力してください" };
    }

    return {
        success: true,
        user: { nickname: trimmed },
        token: trimmed,
    };
};

export const startSession = async (options: {
    periodDays: number;
    historicalDays: number;
}) => {
    const { periodDays, historicalDays } = options;
    const { stocks, prices } = await loadStockCache();

    const totalDaysNeeded = historicalDays + periodDays;
    let selectedStock: Stock | null = null;
    let selectedPrices: StockPrice[] | null = null;
    let practiceStartIndex = 0;
    let practiceStartDate = "";
    let startDate = "";
    let endDate = "";
    let attempts = 0;
    const maxAttempts = 100;

    while (!selectedStock && attempts < maxAttempts) {
        attempts += 1;
        const randomStock = stocks[Math.floor(Math.random() * stocks.length)];
        if (!randomStock) {
            break;
        }

        const stockPrices = prices
            .filter((p) => p.symbol === randomStock.symbol)
            .sort((a, b) => a.date.localeCompare(b.date));

        if (stockPrices.length < totalDaysNeeded) {
            continue;
        }

        const maxStartIndex = stockPrices.length - totalDaysNeeded;
        if (maxStartIndex < 0) {
            continue;
        }

        const startIndex = Math.floor(Math.random() * (maxStartIndex + 1));
        practiceStartIndex = startIndex + historicalDays;
        practiceStartDate = stockPrices[practiceStartIndex]?.date || "";

        selectedPrices = stockPrices.slice(0, practiceStartIndex + periodDays);
        startDate = selectedPrices[0]?.date || "";
        endDate = selectedPrices[selectedPrices.length - 1]?.date || "";

        if (practiceStartIndex + periodDays <= stockPrices.length) {
            selectedStock = randomStock;
        }
    }

    if (!selectedStock || !selectedPrices?.length) {
        return {
            success: false,
            error: "適切な銘柄が見つかりませんでした",
        };
    }

    return {
        success: true,
        stock: selectedStock,
        practiceStartIndex,
        practiceStartDate,
        startDate,
        endDate,
    };
};

export const getSessions = async (nickname: string) => {
    const sessions = await db.sessions.toArray();
    return sessions
        .filter((s) => s.nickname === nickname)
        .sort((a, b) => {
            const aDate = a.createdAt || a.startDate;
            const bDate = b.createdAt || b.startDate;
            return new Date(bDate).getTime() - new Date(aDate).getTime();
        });
};

export const getSessionById = async (nickname: string, sessionId: string) => {
    const session = await db.sessions.get(sessionId);
    if (!session || session.nickname !== nickname) {
        return null;
    }
    return session;
};

export const saveSession = async (session: Session) => {
    const now = new Date().toISOString();
    const existing = session.id ? await db.sessions.get(session.id) : undefined;

    const merged: Session = {
        ...existing,
        ...session,
        createdAt: existing?.createdAt || session.createdAt || now,
        updatedAt: now,
    };

    await db.sessions.put(merged);
    return merged;
};

export const replaceSessions = async (
    nickname: string,
    sessions: Session[],
) => {
    await db.transaction("rw", db.sessions, async () => {
        const existing = await db.sessions.toArray();
        const newIds = new Set(sessions.map((s) => s.id));
        const toDelete = existing.filter(
            (s) => s.nickname === nickname && !newIds.has(s.id),
        );

        if (toDelete.length > 0) {
            await db.sessions.bulkDelete(toDelete.map((s) => s.id as string));
        }

        for (const session of sessions) {
            await saveSession({ ...session, nickname });
        }
    });
};

export const getStockPrices = async (options: {
    symbol: string;
    startDate?: string | null;
    endDate?: string | null;
}) => {
    const { prices } = await loadStockCache();
    const { symbol, startDate, endDate } = options;

    let stockPrices = prices
        .filter((p) => p.symbol === symbol)
        .sort((a, b) => a.date.localeCompare(b.date));

    if (startDate) {
        stockPrices = stockPrices.filter((p) => p.date >= startDate);
    }
    if (endDate) {
        stockPrices = stockPrices.filter((p) => p.date <= endDate);
    }

    return stockPrices;
};

export const getCachedStockData = async () => {
    const { stocks, prices, meta } = await loadStockCache();
    return { stocks, prices, meta };
};
