
"use client";

import type { TCGCardTemplate, CardData, DisplayCard, ExtractedPlaceholder } from '@/types';
import type { ChangeEvent } from 'react';
import { useState, useRef, useCallback } from 'react';
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
}

type SupportedFileType = 'csv'; // Add 'json' etc. later

export function BulkGenerator({ templates, onCardsGenerated }: BulkGeneratorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [bulkDataInput, setBulkDataInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFileType, setSelectedFileType] = useState<SupportedFileType>('csv');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const getPlaceholdersFromSelectedTemplate = useCallback((): ExtractedPlaceholder[] => {
    return selectedTemplate ? extractUniquePlaceholderKeys(selectedTemplate) : [];
  }, [selectedTemplate]);
  
  const placeholderObjects = getPlaceholdersFromSelectedTemplate();
  
  const generateExampleCSV = useCallback(() => {
    if (!selectedTemplate) return "";
    const headers = placeholderObjects.map(p => p.key).join(',');
    const exampleDataLine = placeholderObjects.map(p => {
      const keyLower = p.key.toLowerCase();
      if (p.defaultValue) return `"${p.defaultValue.replace(/"/g, '""')}"`; // Enclose defaults and escape quotes
      if (keyLower.includes('url') || keyLower.includes('artwork')) return 'https://placehold.co/600x400.png?text=Artwork';
      if (keyLower.includes('name')) return 'Sample Card';
      if (keyLower.includes('cost')) return '3';
      if (keyLower.includes('type')) return 'Sample Type';
      if (keyLower.includes('text')) return 'Sample effect text.';
      return 'value';
    }).join(',');
    return `${headers}\n${exampleDataLine}`;
  }, [selectedTemplate, placeholderObjects]);

  const exampleCSV = generateExampleCSV();

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({ title: "Error", description: "Please select a TCG template.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    let generatedCardsData: CardData[] = [];

    try {
      if (!bulkDataInput.trim()) {
        toast({ title: "Error", description: "Please provide data for card generation.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (selectedFileType === 'csv') {
        const lines = bulkDataInput.trim().split('\n');
        if (lines.length < 2) {
          toast({ title: "Error", description: "CSV data must include a header row and at least one data row.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1')); // Remove surrounding quotes from headers
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim() === '') continue;
          const values = lines[i].split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1')); // Remove surrounding quotes
          const cardData: CardData = {};
          headers.forEach((header, index) => {
            cardData[header] = values[index] || '';
          });
          generatedCardsData.push(cardData);
        }
      } else {
        // TODO: Implement other file type parsing (e.g., JSON)
        toast({ title: "Not Implemented", description: `Parsing for ${selectedFileType.toUpperCase()} is not yet supported.`, variant: "default" });
        setIsLoading(false);
        return;
      }
      
      const displayCards = generatedCardsData.map(data => ({ template: selectedTemplate, data, uniqueId: nanoid() }));
      onCardsGenerated(displayCards);
      if (displayCards.length > 0) {
        toast({ title: "Success", description: `${displayCards.length} TCG cards generated.` });
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
        toast({ title: "Invalid File", description: "Please upload a .csv file when CSV format is selected.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
        return;
      }
      // Add more file type checks here if other formats are supported

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setBulkDataInput(text);
        toast({ title: "File Loaded", description: `Content of "${file.name}" loaded into the textarea.` });
      };
      reader.onerror = () => {
         toast({ title: "File Read Error", description: `Could not read file "${file.name}".`, variant: "destructive" });
      };
      reader.readAsText(file);
    }
    // Reset file input to allow re-uploading the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    if (!selectedTemplate) {
      toast({ title: "No Template", description: "Please select a TCG template first.", variant: "default" });
      return;
    }
    if (selectedFileType === 'csv') {
      const csvContent = generateExampleCSV();
      if (!csvContent.trim() || !csvContent.includes('\n')) { // Basic check if headers or example data is missing
         toast({ title: "Template Error", description: "Could not generate CSV template. Ensure template has placeholders.", variant: "destructive" });
         return;
      }
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const safeTemplateName = selectedTemplate.name.replace(/[^a-z0-9_]/gi, '_').substring(0,30);
      link.setAttribute("download", `template_for_${safeTemplateName}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Template Downloaded", description: `CSV template for "${selectedTemplate.name}" downloaded.` });
    } else {
      // TODO: Implement template download for other file types
      toast({ title: "Not Implemented", description: `Template download for ${selectedFileType.toUpperCase()} is not yet supported.`, variant: "default" });
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" />Bulk Card Generation</CardTitle>
        <CardDescription>Generate multiple cards using data from an uploaded file or pasted text, based on a selected template.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bulkTemplateSelect">1. Select Template</Label>
            <Select 
              value={selectedTemplateId} 
              onValueChange={(id) => setSelectedTemplateId(id)}
              disabled={templates.length === 0}
            >
              <SelectTrigger id="bulkTemplateSelect">
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.length > 0 ? (
                  templates.map(t => <SelectItem key={t.id || 'bulk-no-id'} value={t.id!}>{t.name || `Template ${t.id?.substring(0,5)}`}</SelectItem>)
                ) : (
                  <SelectItem value="no-bulk-templates" disabled>No templates available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="fileTypeSelect">2. Select File Format</Label>
            <Select value={selectedFileType} onValueChange={(value) => setSelectedFileType(value as SupportedFileType)}>
              <SelectTrigger id="fileTypeSelect">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (Comma Separated Values)</SelectItem>
                {/* <SelectItem value="json" disabled>JSON (Coming Soon)</SelectItem> */}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
            <Button 
                onClick={() => fileInputRef.current?.click()} 
                variant="outline" 
                disabled={!selectedTemplateId}
                className="w-full sm:w-auto flex-grow sm:flex-grow-0"
            >
                <UploadCloud className="mr-2 h-4 w-4" /> Upload {selectedFileType.toUpperCase()} File
            </Button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept={selectedFileType === 'csv' ? '.csv' : '*/*'} // Adjust accept based on type
                style={{ display: 'none' }}
                id="bulk-file-upload"
            />
            <Button 
                onClick={handleDownloadTemplate} 
                variant="outline"
                disabled={!selectedTemplateId}
                className="w-full sm:w-auto flex-grow sm:flex-grow-0"
            >
                <FileText className="mr-2 h-4 w-4" /> Download {selectedFileType.toUpperCase()} Template
            </Button>
        </div>

        <div>
          <Label htmlFor="bulkData">
            3. Paste Data or Verify Uploaded Content ({selectedFileType.toUpperCase()})
          </Label>
          <Textarea
            id="bulkData"
            value={bulkDataInput}
            onChange={handleDataInputChange}
            placeholder={selectedTemplate ? `Example for "${selectedTemplate.name}" (${selectedFileType.toUpperCase()} format):\n${selectedFileType === 'csv' ? exampleCSV : 'Format for other types will be shown here.'}` : `Select a template and format to see example structure, or upload a file.`}
            rows={8}
            className="font-mono text-sm"
            disabled={!selectedTemplate}
          />
          {selectedTemplate && selectedFileType === 'csv' && <p className="text-xs text-muted-foreground mt-1">
            Your CSV headers should be: <strong>{placeholderObjects.map(p => p.key).join(',') || "No placeholders found in template"}</strong>.
          </p>}
           {!selectedTemplate && <p className="text-xs text-muted-foreground mt-1">Select a template and format first.</p>}
        </div>
        
        <Button onClick={handleGenerate} disabled={isLoading || !selectedTemplateId || !bulkDataInput.trim()} className="w-full">
          {isLoading ? 'Generating...' : <> <Download className="mr-2 h-4 w-4" /> Generate Cards from Data</>}
        </Button>
      </CardContent>
    </Card>
  );
}
