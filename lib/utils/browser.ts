/**
 * ブラウザ環境チェックユーティリティ
 */

/**
 * ブラウザ環境かどうかをチェック
 */
export const isBrowser = typeof window !== 'undefined';

/**
 * モバイル環境かどうかをチェック
 */
export const isMobile = isBrowser && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

/**
 * 安全にwindowオブジェクトにアクセス
 */
export const safeWindow = isBrowser ? window : undefined;
