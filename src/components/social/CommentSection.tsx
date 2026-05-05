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
            <Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white" onClick={() => setIsOpen(true)}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Comentar
            </Button>
        );
    }

    return (
        <div className="w-full mt-4 border-t border-neutral-800 pt-4">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-emerald-500" />
                    Comentarios ({comments.length})
                </h4>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-neutral-500 hover:text-neutral-300" onClick={() => setIsOpen(false)}>
                    Cerrar
                </Button>
            </div>

            <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2 mb-4 scrollbar-thin scrollbar-thumb-neutral-800">
                {comments.length === 0 ? (
                    <p className="text-xs text-neutral-500 text-center italic">Sé el primero en comentar.</p>
                ) : (
                    comments.map((c) => (
                        <div key={c.id} className="flex items-start gap-3">
                            <Avatar className="w-6 h-6 border border-neutral-800">
                                <AvatarFallback className="text-[10px] bg-neutral-800 text-neutral-400">
                                    {(c.users?.nombre || "U").substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 bg-neutral-900/50 rounded-xl p-2.5 border border-neutral-800/50">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-white">{c.users?.nombre || "Usuario"}</span>
                                    <span className="text-[10px] text-neutral-500">
                                        {new Date(c.created_at).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-sm text-neutral-300 break-words">{c.comentario}</p>
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
                        className="bg-neutral-900 border-neutral-800 text-sm h-9"
                        disabled={isLoading}
                    />
                    <Button type="submit" size="icon" className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white" disabled={isLoading || !newComment.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            ) : (
                <p className="text-xs text-neutral-500 text-center">Inicia sesión para comentar.</p>
            )}
        </div>
    );
}
