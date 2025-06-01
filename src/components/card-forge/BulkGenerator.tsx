
"use client";

import type { TCGCardTemplate, CardData, DisplayCard } from '@/types';
import type { ChangeEvent } from 'react';
import { useState, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { Download, PackagePlus, UploadCloud, FileText } from 'lucide-react';
import { extractUniquePlaceholderKeys } from '@/lib/utils';

interface BulkGeneratorProps {
  templates: TCGCardTemplate[];
  onCardsGenerated: (cards: DisplayCard[]) => void;
  selectedTemplateIdProp: string | null; // From Zustand store via props
  onTemplateSelectionChange: (templateId: string | null) => void; // Calls Zustand action via props
}

type SupportedFileType = 'csv';

export function BulkGenerator({ 
  templates, 
  onCardsGenerated,
  selectedTemplateIdProp,
  onTemplateSelectionChange 
}: BulkGeneratorProps) {
  // Local state for this component's form
  const [bulkDataInput, setBulkDataInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFileType] = useState<SupportedFileType>('csv'); 
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // selectedTemplate is derived from selectedTemplateIdProp (from Zustand) and templates prop.
  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateIdProp);
  }, [templates, selectedTemplateIdProp]);

  // placeholderObjects is derived from selectedTemplate.
  const placeholderObjects = useMemo(() => {
    if (!selectedTemplate) return [];
    return extractUniquePlaceholderKeys(selectedTemplate);
  }, [selectedTemplate]);


  const generateExampleCSV = useCallback(() => {
    if (!selectedTemplate) return "Select a template first.";

    const headers = placeholderObjects.map(p => p.key).join(',');
    const exampleDataLine = placeholderObjects.map(p => {
      const keyLower = p.key.toLowerCase();
      if (p.defaultValue) return `"${p.defaultValue.replace(/"/g, '""')}"`;
      if (keyLower.includes('url') || keyLower.includes('artwork')) return 'https://placehold.co/600x400.png?text=Artwork';
      if (keyLower.includes('name') || keyLower.includes('title')) return 'Sample Card';
      if (keyLower.includes('cost') || keyLower.includes('value')) return '3';
      if (keyLower.includes('type')) return 'Sample Type';
      if (keyLower.includes('text') || keyLower.includes('desc')) return 'Sample effect text.';
      return 'value';
    }).join(',');
    return `${headers}\n${exampleDataLine}`;
  }, [placeholderObjects, selectedTemplate]);

  const exampleCSV = useMemo(() => generateExampleCSV(), [generateExampleCSV]);

  // Comment: The selectedTemplateIdProp is managed by Zustand.
  // Defaulting logic (e.g., selecting the first template if the current one is invalid)
  // is handled by the Zustand store's _rehydrateCallback or actions like deleteTemplate.
  // No local useEffect is needed here to manage selectedTemplateId.

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({ title: "Template Required", description: "Please select a TCG template for the cards.", variant: "destructive" });
      return;
    }
    if (!bulkDataInput.trim()) {
      toast({ title: "Error", description: "Please provide data for card generation.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const lines = bulkDataInput.trim().split('\n');
      if (lines.length < 2) {
        toast({ title: "Error", description: "CSV data must include a header row and at least one data row.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'));
      const generatedCards: DisplayCard[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        const values = lines[i].split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));
        const cardData: CardData = {};
        headers.forEach((header, index) => {
          cardData[header] = values[index] || '';
        });

        const displayCard: DisplayCard = {
            template: selectedTemplate,
            data: cardData,
            uniqueId: nanoid()
        };
        generatedCards.push(displayCard);
      }

      onCardsGenerated(generatedCards);
      if (generatedCards.length > 0) {
        toast({ title: "Success", description: `${generatedCards.length} TCG cards generated.` });
      } else {
        toast({ title: "No Cards Generated", description: "No data was processed to generate cards.", variant: "default" });
      }

    } catch (error) {
      console.error("Error generating TCG cards:", error);
      toast({ title: "Generation Error", description: `Failed to generate TCG cards: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setBulkDataInput(e.target.value);
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (selectedFileType === 'csv' && !file.name.toLowerCase().endsWith('.csv')) {
        toast({ title: "Invalid File", description: "Please upload a .csv file.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setBulkDataInput(text);
        toast({ title: "File Loaded", description: `Content of "${file.name}" loaded.` });
      };
      reader.onerror = () => {
         toast({ title: "File Read Error", description: `Could not read file "${file.name}".`, variant: "destructive" });
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplateCSV = () => {
    if (!selectedTemplate) {
      toast({ title: "Template Required", description: "Please select a TCG template first.", variant: "default" });
      return;
    }
    const csvContent = exampleCSV;
    if (!csvContent.trim() || !csvContent.includes('\n') || csvContent.startsWith("Select a template first.")) {
       toast({ title: "Template Error", description: "Could not generate CSV template. Ensure template has placeholders.", variant: "destructive" });
       return;
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const safeTemplateName = selectedTemplate.name.replace(/[^a-z0-9_]/gi, '_').substring(0,20);
    const fileName = `template_${safeTemplateName}.csv`;
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Template Downloaded", description: `${fileName} downloaded.` });
  };

  const handleTemplateSelectChange = useCallback((id: string | null) => {
    onTemplateSelectionChange(id);
    setBulkDataInput(''); // Clear data input when template changes
  }, [onTemplateSelectionChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" />Bulk Card Generation</CardTitle>
        <CardDescription>Generate multiple cards using CSV data, based on a selected template.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
            <Label htmlFor="bulkTemplateSelect">1. Select Template*</Label>
            <Select
              value={selectedTemplateIdProp ?? undefined} // Use prop from Zustand
              onValueChange={handleTemplateSelectChange} // Calls Zustand action via prop
              disabled={templates.length === 0}
            >
              <SelectTrigger id="bulkTemplateSelect">
                <SelectValue placeholder="Choose template (Required)" />
              </SelectTrigger>
              <SelectContent>
                {templates.length > 0 ? (
                  templates.map(t => <SelectItem key={`bulk-template-${t.id || 'bulk-no-id'}`} value={t.id!}>{t.name || `Template ${t.id?.substring(0,5)}`}</SelectItem>)
                ) : (
                  <SelectItem value="no-bulk-templates" disabled>No templates available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

        <div className="flex flex-col sm:flex-row gap-2">
            <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                disabled={!selectedTemplateIdProp}
                className="w-full sm:w-auto flex-grow sm:flex-grow-0"
            >
                <UploadCloud className="mr-2 h-4 w-4" /> Upload CSV File
            </Button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv"
                style={{ display: 'none' }}
                id="bulk-file-upload-csv"
            />
            <Button
                onClick={handleDownloadTemplateCSV}
                variant="outline"
                disabled={!selectedTemplateIdProp}
                className="w-full sm:w-auto flex-grow sm:flex-grow-0"
            >
                <FileText className="mr-2 h-4 w-4" /> Download Example CSV
            </Button>
        </div>

        <div>
          <Label htmlFor="bulkData">
            2. Paste CSV Data or Verify Uploaded Content
          </Label>
          <Textarea
            id="bulkData"
            value={bulkDataInput}
            onChange={handleDataInputChange}
            placeholder={selectedTemplate ? `Example CSV for "${selectedTemplate.name}":\n${exampleCSV}` : `Select a template to see example CSV structure.`}
            rows={8}
            className="font-mono text-sm"
            disabled={!selectedTemplateIdProp}
          />
          {selectedTemplate && <p className="text-xs text-muted-foreground mt-1">
            Your CSV headers should be: <strong>{placeholderObjects.map(p => p.key).join(',') || "No placeholders found in selected template"}</strong>.
          </p>}
           {!selectedTemplateIdProp && <p className="text-xs text-muted-foreground mt-1">Select a template first.</p>}
        </div>

        <Button onClick={handleGenerate} disabled={isLoading || !selectedTemplateIdProp || !bulkDataInput.trim()} className="w-full">
          {isLoading ? 'Generating...' : <> <Download className="mr-2 h-4 w-4" /> Generate Cards from Data</>}
        </Button>
      </CardContent>
    </Card>
  );
}
