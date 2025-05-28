
"use client";

import { useState, ChangeEvent, FormEvent } from 'react';
import type { AbilityContextSet } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { PlusCircle, Edit2, Trash2, Save, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AbilityContextManagerProps {
  contextSets: AbilityContextSet[];
  onContextSetsChange: (updatedContextSets: AbilityContextSet[]) => void;
}

export function AbilityContextManager({ contextSets, onContextSetsChange }: AbilityContextManagerProps) {
  const { toast } = useToast();
  const [editingSet, setEditingSet] = useState<AbilityContextSet | null>(null);
  const [setName, setSetName] = useState('');
  const [setDescription, setSetDescription] = useState('');

  const resetForm = () => {
    setEditingSet(null);
    setSetName('');
    setSetDescription('');
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!setName.trim() || !setDescription.trim()) {
      toast({ title: "Validation Error", description: "Name and description are required.", variant: "destructive" });
      return;
    }

    let updatedSets;
    if (editingSet) {
      updatedSets = contextSets.map(cs =>
        cs.id === editingSet.id ? { ...cs, name: setName, description: setDescription } : cs
      );
      toast({ title: "Context Set Updated", description: `"${setName}" has been updated.` });
    } else {
      const newSet: AbilityContextSet = { id: nanoid(), name: setName, description: setDescription };
      updatedSets = [...contextSets, newSet];
      toast({ title: "Context Set Added", description: `"${setName}" has been added.` });
    }
    onContextSetsChange(updatedSets);
    resetForm();
  };

  const handleEdit = (contextSet: AbilityContextSet) => {
    setEditingSet(contextSet);
    setSetName(contextSet.name);
    setSetDescription(contextSet.description);
  };

  const handleDelete = (id: string) => {
    const setToDelete = contextSets.find(cs => cs.id === id);
    onContextSetsChange(contextSets.filter(cs => cs.id !== id));
    toast({ title: "Context Set Deleted", description: `"${setToDelete?.name}" has been removed.` });
    if (editingSet?.id === id) {
      resetForm();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {editingSet ? <Edit2 className="h-5 w-5 text-primary" /> : <PlusCircle className="h-5 w-5 text-primary" />}
            {editingSet ? 'Edit Context Set' : 'Add New Context Set'}
          </CardTitle>
          <CardDescription>
            {editingSet ? `Editing "${editingSet.name}".` : "Create a reusable block of text (rules, abilities, lore) to guide AI generation."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSave}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="contextSetName">Set Name</Label>
              <Input
                id="contextSetName"
                value={setName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSetName(e.target.value)}
                placeholder="e.g., Core Mechanics, Faction Lore, Specific Keyword Abilities"
                required
              />
            </div>
            <div>
              <Label htmlFor="contextSetDescription">Description (Rules/Abilities/Lore Text)</Label>
              <Textarea
                id="contextSetDescription"
                value={setDescription}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setSetDescription(e.target.value)}
                placeholder="Paste or write your detailed context here. This text will be provided to the AI."
                rows={10}
                required
                className="min-h-[150px]"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            {editingSet && (
              <Button type="button" variant="outline" onClick={resetForm} className="flex items-center gap-2">
                <XCircle className="h-4 w-4" /> Cancel Edit
              </Button>
            )}
            <Button type="submit" className="flex items-center gap-2 ml-auto">
              <Save className="h-4 w-4" /> {editingSet ? 'Save Changes' : 'Add Context Set'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Saved Context Sets ({contextSets.length})</CardTitle>
          <CardDescription>These sets can be selected in the card generators to provide context to the AI.</CardDescription>
        </CardHeader>
        <CardContent>
          {contextSets.length === 0 ? (
            <p className="text-muted-foreground">No context sets saved yet. Add one using the form on the left.</p>
          ) : (
            <ScrollArea className="h-[calc(100vh-300px)] pr-3">
              <ul className="space-y-3">
                {contextSets.map(cs => (
                  <li key={cs.id} className="border rounded-md p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-primary">{cs.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{cs.description}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 ml-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(cs)} aria-label={`Edit ${cs.name}`}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Delete ${cs.name}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the context set "{cs.name}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(cs.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
