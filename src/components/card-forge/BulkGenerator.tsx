
"use client";

import type { TCGCardTemplate, CardData, DisplayCard, ExtractedPlaceholder } from '@/types';
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

const NO_BACK_TEMPLATE_VALUE = "no-back-template";

interface BulkGeneratorProps {
  templates: TCGCardTemplate[];
  onCardsGenerated: (cards: DisplayCard[]) => void;
}

type SupportedFileType = 'csv';

export function BulkGenerator({ templates, onCardsGenerated }: BulkGeneratorProps) {
  const [selectedFrontTemplateId, setSelectedFrontTemplateId] = useState<string>(templates[0]?.id || '');
  const [selectedBackTemplateId, setSelectedBackTemplateId] = useState<string | null>(null); // Changed initial to null
  const [bulkDataInput, setBulkDataInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFileType] = useState<SupportedFileType>('csv'); // CSV is the only supported type for now
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFrontTemplate = useMemo(() => templates.find(t => t.id === selectedFrontTemplateId), [templates, selectedFrontTemplateId]);
  const selectedBackTemplate = useMemo(() => selectedBackTemplateId ? templates.find(t => t.id === selectedBackTemplateId) : null, [templates, selectedBackTemplateId]);

  const getCombinedPlaceholders = useCallback((): ExtractedPlaceholder[] => {
    const combined = new Map<string, ExtractedPlaceholder>();
    if (selectedFrontTemplate) {
      extractUniquePlaceholderKeys(selectedFrontTemplate).forEach(p => {
        combined.set(`front_${p.key}`, { key: `front_${p.key}`, defaultValue: p.defaultValue });
      });
    }
    if (selectedBackTemplate) {
      extractUniquePlaceholderKeys(selectedBackTemplate).forEach(p => {
        combined.set(`back_${p.key}`, { key: `back_${p.key}`, defaultValue: p.defaultValue });
      });
    }
    return Array.from(combined.values());
  }, [selectedFrontTemplate, selectedBackTemplate]);

  const placeholderObjects = getCombinedPlaceholders();

  const generateExampleCSV = useCallback(() => {
    if (!selectedFrontTemplate) return "Select a front template first.";

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
  }, [placeholderObjects, selectedFrontTemplate]);

  const exampleCSV = generateExampleCSV();

  const handleGenerate = async () => {
    if (!selectedFrontTemplate) {
      toast({ title: "Front Template Required", description: "Please select a TCG template for the card front.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    let generatedCards: DisplayCard[] = [];

    try {
      if (!bulkDataInput.trim()) {
        toast({ title: "Error", description: "Please provide data for card generation.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const lines = bulkDataInput.trim().split('\n');
      if (lines.length < 2) {
        toast({ title: "Error", description: "CSV data must include a header row and at least one data row.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'));

      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        const values = lines[i].split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));
        const rawRowData: CardData = {};
        headers.forEach((header, index) => {
          rawRowData[header] = values[index] || '';
        });

        const frontData: CardData = {};
        const backData: CardData = {};

        Object.entries(rawRowData).forEach(([key, value]) => {
          if (key.startsWith('front_')) {
            frontData[key.substring(6)] = value;
          } else if (key.startsWith('back_')) {
            backData[key.substring(5)] = value;
          } else {
            if (!(`front_${key}` in rawRowData)) {
              frontData[key] = value;
            }
          }
        });

        const displayCard: DisplayCard = {
            frontTemplate: selectedFrontTemplate,
            frontData: frontData,
            backTemplate: selectedBackTemplate || null,
            backData: selectedBackTemplate ? backData : null,
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
    if (!selectedFrontTemplate) {
      toast({ title: "Front Template Required", description: "Please select a front TCG template first.", variant: "default" });
      return;
    }
    const csvContent = generateExampleCSV();
    if (!csvContent.trim() || !csvContent.includes('\n') || csvContent.startsWith("Select a front template first.")) {
       toast({ title: "Template Error", description: "Could not generate CSV template. Ensure template(s) have placeholders.", variant: "destructive" });
       return;
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const safeFrontTemplateName = selectedFrontTemplate.name.replace(/[^a-z0-9_]/gi, '_').substring(0,20);
    const safeBackTemplateName = selectedBackTemplate ? selectedBackTemplate.name.replace(/[^a-z0-9_]/gi, '_').substring(0,15) : "";
    const fileName = selectedBackTemplateId ? `template_front_${safeFrontTemplateName}_back_${safeBackTemplateName}.csv` : `template_front_${safeFrontTemplateName}.csv`;
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Template Downloaded", description: `${fileName} downloaded.` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" />Bulk Card Generation</CardTitle>
        <CardDescription>Generate multiple cards using CSV data, based on selected front and optional back templates.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bulkFrontTemplateSelect">1. Select Front Template*</Label>
            <Select
              value={selectedFrontTemplateId}
              onValueChange={(id) => setSelectedFrontTemplateId(id)}
              disabled={templates.length === 0}
            >
              <SelectTrigger id="bulkFrontTemplateSelect">
                <SelectValue placeholder="Choose front template (Required)" />
              </SelectTrigger>
              <SelectContent>
                {templates.length > 0 ? (
                  templates.map(t => <SelectItem key={`front-bulk-${t.id || 'bulk-no-id'}`} value={t.id!}>{t.name || `Template ${t.id?.substring(0,5)}`}</SelectItem>)
                ) : (
                  <SelectItem value="no-bulk-templates-front" disabled>No templates available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="bulkBackTemplateSelect">2. Select Back Template (Optional)</Label>
            <Select
              value={selectedBackTemplateId ?? NO_BACK_TEMPLATE_VALUE}
              onValueChange={(id) => setSelectedBackTemplateId(id === NO_BACK_TEMPLATE_VALUE ? null : id)}
              disabled={templates.length === 0}
            >
              <SelectTrigger id="bulkBackTemplateSelect">
                <SelectValue placeholder="Choose back template (Optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BACK_TEMPLATE_VALUE}>No Back Template</SelectItem>
                {templates.map(t => <SelectItem key={`back-bulk-${t.id || 'bulk-no-id-back'}`} value={t.id!}>{t.name || `Template ${t.id?.substring(0,5)}`}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
            <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                disabled={!selectedFrontTemplateId}
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
                disabled={!selectedFrontTemplateId}
                className="w-full sm:w-auto flex-grow sm:flex-grow-0"
            >
                <FileText className="mr-2 h-4 w-4" /> Download Example CSV
            </Button>
        </div>

        <div>
          <Label htmlFor="bulkData">
            3. Paste CSV Data or Verify Uploaded Content
          </Label>
          <Textarea
            id="bulkData"
            value={bulkDataInput}
            onChange={handleDataInputChange}
            placeholder={selectedFrontTemplate ? `Example CSV for "${selectedFrontTemplate.name}" ${selectedBackTemplate ? `and back "${selectedBackTemplate.name}"` : ''}:\n${exampleCSV}` : `Select a front template to see example CSV structure.`}
            rows={8}
            className="font-mono text-sm"
            disabled={!selectedFrontTemplateId}
          />
          {selectedFrontTemplate && <p className="text-xs text-muted-foreground mt-1">
            Your CSV headers should be: <strong>{placeholderObjects.map(p => p.key).join(',') || "No placeholders found in selected template(s)"}</strong>.
            Prefix front template fields with "front_" and back template fields with "back_".
          </p>}
           {!selectedFrontTemplateId && <p className="text-xs text-muted-foreground mt-1">Select a front template first.</p>}
        </div>

        <Button onClick={handleGenerate} disabled={isLoading || !selectedFrontTemplateId || !bulkDataInput.trim()} className="w-full">
          {isLoading ? 'Generating...' : <> <Download className="mr-2 h-4 w-4" /> Generate Cards from Data</>}
        </Button>
      </CardContent>
    </Card>
  );
}
