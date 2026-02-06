import { Edit } from "lucide-react";

interface ReflectionModalProps {
    isOpen: boolean;
    isEditingMode: boolean;
    reflection: string;
    selectedSession: any;
    onClose: () => void;
    onEditModeChange: (editing: boolean) => void;
    onReflectionChange: (value: string) => void;
    onSave: () => void;
}

export default function ReflectionModal({
    isOpen,
    isEditingMode,
    reflection,
    selectedSession,
    onClose,
    onEditModeChange,
    onReflectionChange,
    onSave,
}: ReflectionModalProps) {
    if (!isOpen) {
        return null;
    }

    const handleCancel = () => {
        if (selectedSession?.reflection) {
            onReflectionChange(selectedSession.reflection);
            onEditModeChange(false);
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}>
            <div className="absolute inset-0 overflow-y-auto flex items-center justify-center p-4">
                <div
                    className="bg-background rounded-lg p-6 max-w-2xl w-full flex flex-col max-h-[85vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">
                            セッションの感想・反省
                        </h2>
                        {!isEditingMode && selectedSession?.reflection && (
                            <button
                                onClick={() => onEditModeChange(true)}
                                className="flex items-center gap-2 px-3 py-1.5 border rounded-md hover:bg-accent transition text-sm"
                            >
                                <Edit className="w-4 h-4" />
                                編集
                            </button>
                        )}
                    </div>

                    {isEditingMode ? (
                        <>
                            <p className="text-sm text-muted-foreground mb-4">
                                このセッションで気づいたこと、良かった点、改善点などを記録しましょう
                            </p>
                            <div className="flex-1 overflow-y-auto mb-4">
                                <textarea
                                    value={reflection}
                                    onChange={(e) =>
                                        onReflectionChange(e.target.value)
                                    }
                                    className="w-full h-48 p-3 border rounded-md resize-none text-base"
                                    placeholder="例：&#10;・エントリータイミングが早すぎた&#10;・損切りルールを守れた&#10;・次回は移動平均線のクロスを待ってから入る"
                                    style={{ fontSize: "16px" }}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={onSave}
                                    className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition"
                                >
                                    保存
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="px-4 py-2 border rounded-md hover:bg-accent transition"
                                >
                                    キャンセル
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex-1 overflow-y-auto mb-4">
                                <div className="bg-muted/30 rounded-lg p-4">
                                    <div className="whitespace-pre-wrap text-sm">
                                        {selectedSession?.reflection ||
                                            "反省文が記録されていません"}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border rounded-md hover:bg-accent transition"
                                >
                                    閉じる
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
