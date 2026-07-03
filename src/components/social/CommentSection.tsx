"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle } from "lucide-react";
import { addComment, getComments } from "@/app/(dashboard)/novedades/social-actions";

type Comment = {
    id: string;
    comentario: string;
    created_at: string;
    user_id: string;
    users?: { nombre: string };
};

export function CommentSection({ partidoId, currentUserId }: { partidoId: string, currentUserId: string | null }) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadComments();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const loadComments = async () => {
        try {
            const data = await getComments(partidoId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setComments(data as any);
        } catch (error) {
            console.error("Failed to load comments:", error);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUserId) return;

        setIsLoading(true);
        try {
            await addComment(partidoId, currentUserId, newComment);
            setNewComment("");
            await loadComments();
        } catch (error) {
            console.error("Failed to add comment:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <Button variant="ghost" size="sm" className="text-olive/70 hover:text-ink" onClick={() => setIsOpen(true)}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Comentar
            </Button>
        );
    }

    return (
        <div className="w-full mt-4 border-t border-olive/20 pt-4">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-emerald-700" />
                    Comentarios ({comments.length})
                </h4>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-olive/60 hover:text-ink-soft" onClick={() => setIsOpen(false)}>
                    Cerrar
                </Button>
            </div>

            <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2 mb-4 scrollbar-thin scrollbar-thumb-olive/20">
                {comments.length === 0 ? (
                    <p className="text-xs text-olive/60 text-center italic">Sé el primero en comentar.</p>
                ) : (
                    comments.map((c) => (
                        <div key={c.id} className="flex items-start gap-3">
                            <Avatar className="w-6 h-6 border border-olive/20">
                                <AvatarFallback className="text-[10px] bg-olive/10 text-olive/70">
                                    {(c.users?.nombre || "U").substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 bg-paper-soft/60 rounded-xl p-2.5 border border-olive/10">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-ink">{c.users?.nombre || "Usuario"}</span>
                                    <span className="text-[10px] text-olive/60">
                                        {new Date(c.created_at).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-sm text-ink-soft break-words">{c.comentario}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {currentUserId ? (
                <form onSubmit={handleAddComment} className="flex items-center gap-2">
                    <Input
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escribe un comentario..."
                        className="bg-paper-soft border-olive/20 text-sm h-9"
                        disabled={isLoading}
                    />
                    <Button type="submit" size="icon" className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-ink" disabled={isLoading || !newComment.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            ) : (
                <p className="text-xs text-olive/60 text-center">Inicia sesión para comentar.</p>
            )}
        </div>
    );
}
