
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  PlusIcon, 
  ArrowDownTrayIcon, 
  DocumentArrowUpIcon, 
  CheckCircleIcon, 
  ClockIcon,
  ExclamationCircleIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  EyeIcon, 
  PencilIcon
} from '@heroicons/react/24/outline';
import { ParsedFile, ParseStatus } from './types';
import { convertToCSV, downloadCSV } from './utils/csvHelper';
import { useUpdates } from './services/useUpdates'


const App: React.FC = () => {
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useUpdates(setFiles);

  useEffect(() => {
    const loadSavedFiles = async () => {
      const res = await fetch('/.netlify/functions/getResults');

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`getResults failed: ${text}`);
      }
      const data = await res.json();

      setFiles(data.map((f: any) => ({
        id: f.id,
        fileName: f.file_name,
        elementNumber: f.element_number,
        notes: f.notes,
        rows: f.rows,
        status: f.status,
        checkedByPhoebe: f.checked_by_phoebe,
        checkedByJay: f.checked_by_jay,
        timestamp: new Date(f.created_at).getTime(),
        imageUrl: f.image_url
      })));
      
    };
    loadSavedFiles();
  }, []);


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsUploading(true);

    for (const file of Array.from(uploadedFiles)) {
      const tempId = Math.random().toString(36).substr(2, 9);

      // 1. Add pending UI row
      setFiles(prev => [{
        id: tempId,
        fileName: file.name,
        elementNumber: 'Pending...',
        status: ParseStatus.PROCESSING,
        notes: '',
        checkedByPhoebe: false,
        checkedByJay: false,
        rows: [],
        timestamp: Date.now(),
        imageUrl: URL.createObjectURL(file),
      }, ...prev]);

      try {
        const base64 = await fileToBase64(file);

        const uploadRes = await fetch('/.netlify/functions/uploadImage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            base64Image: base64,
            contentType: file.type,
          }),
        });

        if (!uploadRes.ok) throw new Error('Image upload failed');
        const { imageUrl } = await uploadRes.json();

        const parseRes = await fetch('/.netlify/functions/parseFuelImage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: imageUrl }),
        });

        if (!parseRes.ok) throw new Error('Parsing failed');
        const parsed = await parseRes.json();

        const saveRes = await fetch('/.netlify/functions/saveResults', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name: file.name,
            image_url: imageUrl,
            element_number: parsed.elementNumber,
            notes: parsed.outliers,
            rows: parsed.rows,
            status: 'COMPLETED',
            checked_by_phoebe: false,
            checked_by_jay: false,
          }),
        });

        if (!saveRes.ok) throw new Error('Saving results failed');
        const { id } = await saveRes.json();

        // 2. Update existing row
        setFiles(prev =>
          prev.map(f =>
            f.id === tempId
              ? {
                  ...f,
                  id,
                  elementNumber: parsed.element_number,
                  notes: parsed.notes,
                  rows: parsed.rows,
                  status: ParseStatus.COMPLETED,
                  imageUrl,
                }
              : f
          )
        );
      } catch (error) {
        setFiles(prev =>
          prev.map(f =>
            f.id === tempId
              ? {
                  ...f,
                  status: ParseStatus.FAILED,
                  error: error instanceof Error ? error.message : 'Parsing failed',
                }
              : f
          )
        );
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const toggleCheck = async (id: string, person: 'phoebe' | 'jay') => {
    setFiles(prev =>
      prev.map(f => {
        if (f.id === id) {
          const updated = {
            ...f,
            checkedByPhoebe: person === 'phoebe' ? !f.checkedByPhoebe : f.checkedByPhoebe,
            checkedByJay: person === 'jay' ? !f.checkedByJay : f.checkedByJay,
          };

          fetch('/.netlify/functions/updateCheck', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              checked_by_phoebe: updated.checkedByPhoebe,
              checked_by_jay: updated.checkedByJay
            })
          });

          return updated;
        }
        return f;
      })
    );
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredFiles = files.filter(f => 
    f.fileName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.elementNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredFiles.length && filteredFiles.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.imageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(file.imageUrl);
      }
      return prev.filter(f => f.id !== id);
    });
    // setExpandedNotes(prev => {
    //   const next = new Set(prev);
    //   next.delete(id);
    //   return next;
    // });
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const deleteSelected = () => {
    files.forEach(f => {
      if (selectedIds.has(f.id) && f.imageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(f.imageUrl);
      }
    });
    setFiles(prev => prev.filter(f => !selectedIds.has(f.id)));
    // setExpandedNotes(prev => {
    //   const next = new Set(prev);
    //   selectedIds.forEach(id => next.delete(id));
    //   return next;
    // });
    setSelectedIds(new Set());
  };

  const downloadSingle = (file: ParsedFile) => {
    if (file.status !== ParseStatus.COMPLETED) return;
    const csvContent = convertToCSV(file.rows);
    downloadCSV(csvContent, `fuel_${file.elementNumber || file.fileName}.csv`);
  };

  const downloadSelected = () => {
    files
      .filter(f => selectedIds.has(f.id) && f.status === ParseStatus.COMPLETED)
      .forEach(file => {
        const csvContent = convertToCSV(file.rows);
        downloadCSV(csvContent, `fuel_${file.elementNumber || file.fileName}.csv`);
      });
  };

  const downloadAll = () => {
    files.filter(f => f.status === ParseStatus.COMPLETED).forEach(file => {
      downloadSingle(file);
    });
  };

  const saveField = async (id: string, fields: Partial<ParsedFile>) => {
    await fetch('/.netlify/functions/updateResult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    });
  };

  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  const runQueueProcessor = async () => {
    try {
      setIsProcessingQueue(true);

      const res = await fetch('/.netlify/functions/testProcessQueue', {
        method: 'GET',
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const result = await res.json();
      console.log('Queue run result:', result);

      // OPTIONAL: refresh results after processing
      const refreshed = await fetch('/.netlify/functions/getResults');
      const data = await refreshed.json();

      setFiles(data.map((f: any) => ({
        id: f.id,
        fileName: f.file_name,
        elementNumber: f.element_number,
        notes: f.notes,
        rows: f.rows,
        status: f.status,
        checkedByPhoebe: f.checked_by_phoebe,
        checkedByJay: f.checked_by_jay,
        timestamp: new Date(f.created_at).getTime(),
        imageUrl: f.image_url
      })));

    } catch (err) {
      console.error('Failed to process queue', err);
      alert('Queue processing failed. Check logs.');
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const stats = {
    total: files.length,
    completed: files.filter(f => f.status === ParseStatus.COMPLETED).length,
    pending: files.filter(f => f.status === ParseStatus.PROCESSING).length,
    failed: files.filter(f => f.status === ParseStatus.FAILED).length,
  };

  const [columnOrder, setColumnOrder] = useState<string[]>([]);


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <DocumentArrowUpIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-none">OCR Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
             <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition shadow-sm disabled:opacity-50"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Upload Images
              </button>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
              />
              <button 
                onClick={downloadAll}
                disabled={stats.completed === 0}
                className="inline-flex items-center px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition shadow-sm disabled:opacity-50"
              >
                <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
                Download All
              </button>
              <button
                onClick={runQueueProcessor}
                disabled={isProcessingQueue}
                className="inline-flex items-center px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition shadow-sm disabled:opacity-50"
              >
                {isProcessingQueue ? (
                  <>
                    <ClockIcon className="w-5 h-5 mr-2 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <DocumentArrowUpIcon className="w-5 h-5 mr-2" />
                    Process Queue
                  </>
                )}
              </button>
          </div>
        </div>
      </header>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center space-x-6">
            <div className="flex items-center space-x-3 pr-6 border-r border-slate-700">
              <span className="flex items-center justify-center bg-indigo-500 text-white w-6 h-6 rounded-full text-xs font-bold">
                {selectedIds.size}
              </span>
              <span className="text-sm font-medium">Selected</span>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={downloadSelected}
                className="inline-flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition"
              >
                <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                Download
              </button>
              <button 
                onClick={deleteSelected}
                className="inline-flex items-center px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg text-sm font-semibold transition"
              >
                <TrashIcon className="w-4 h-4 mr-2" />
                Delete
              </button>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition"
                title="Deselect all"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 md:p-8"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative w-full max-w-5xl h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 bg-white text-slate-900 p-2 rounded-full shadow-lg hover:bg-slate-100"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>

            <div className="flex-1 bg-white rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center p-2">
              <img
                src={previewImage}
                alt="Document preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
      {editingFile && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-bold">Edit CSV</h2>
              <button onClick={() => setEditingFile(null)}>✕</button>
            </div>

            {/* <div className="overflow-auto p-4 flex-1">
              <table className="w-full text-xs border">
                <tbody>
                  {editingFile.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {Object.entries(row).map(([key, val]) => (
                        <td key={key} className="border p-1">
                          <input
                            value={val as string}
                            onChange={(e) => {
                              const value = e.target.value;
                              setEditingFile(prev => {
                                if (!prev) return prev;
                                const rows = [...prev.rows];
                                rows[rIdx] = { ...rows[rIdx], [key]: value };
                                return { ...prev, rows };
                              });
                            }}
                            className="w-full border rounded px-1"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div> */}
            <div className="overflow-auto p-4 flex-1">
              {editingFile.rows.length > 0 && (
                <table className="w-full text-xs border border-slate-300 border-collapse">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr>
                      {Object.keys(editingFile.rows[0]).map(col => (
                        <th
                          key={col}
                          className="border border-slate-300 px-2 py-1 text-left font-semibold"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {editingFile.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {Object.keys(editingFile.rows[0]).map(col => (
                          <td key={col} className="border border-slate-300 p-1">
                            <input
                              value={(row as any)[col] ?? ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setEditingFile(prev => {
                                  if (!prev) return prev;
                                  const rows = [...prev.rows];
                                  rows[rIdx] = { ...rows[rIdx], [col]: value };
                                  return { ...prev, rows };
                                });
                              }}
                              className="w-full border rounded px-1"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setEditingFile(null)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await saveField(editingFile.id, { rows: editingFile.rows });
                  setFiles(prev =>
                    prev.map(f => f.id === editingFile.id ? editingFile : f)
                  );
                  setEditingFile(null);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard label="Total Files" value={stats.total} icon={<DocumentArrowUpIcon className="w-6 h-6 text-indigo-500" />} />
          <StatCard label="Parsed" value={stats.completed} icon={<CheckCircleIcon className="w-6 h-6 text-emerald-500" />} />
          <StatCard label="In Progress" value={stats.pending} icon={<ClockIcon className="w-6 h-6 text-amber-500" />} />
          <StatCard label="Failed" value={stats.failed} icon={<ExclamationCircleIcon className="w-6 h-6 text-rose-500" />} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search by filename or element number..." 
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="text-sm text-slate-500 font-medium">
              Showing {filteredFiles.length} of {files.length} records
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 w-4">
                    <input 
                      type="checkbox" 
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={filteredFiles.length > 0 && selectedIds.size === filteredFiles.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">File Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Element #</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Notes / Outliers</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Phoebe</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Jay</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">
                      No records found. Upload images to begin.
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map((file) => {
                    // const isExpanded = expandedNotes.has(file.id);
                    const isSelected = selectedIds.has(file.id);
                    return (
                      <tr 
                        key={file.id} 
                        className={`transition-colors align-top ${isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-6 py-5">
                          <input 
                            type="checkbox" 
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            checked={isSelected}
                            onChange={() => toggleSelection(file.id)}
                          />
                        </td>
                        <td className="px-3 py-4">
                          <StatusBadge status={file.status} error={file.error} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900 truncate max-w-[150px]">{file.fileName}</span>
                            <span className="text-xs text-slate-400">{new Date(file.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            value={file.elementNumber || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setFiles(prev =>
                                prev.map(f =>
                                  f.id === file.id ? { ...f, elementNumber: value } : f
                                )
                              );
                            }}
                            onBlur={() => saveField(file.id, { element_number: file.elementNumber })}
                            className="w-28 text-sm font-mono border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-6 py-4 min-w-[240px]">
                          <textarea
                            value={file.notes || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setFiles(prev =>
                                prev.map(f =>
                                  f.id === file.id ? { ...f, notes: value } : f
                                )
                              );
                            }}
                            onBlur={() => saveField(file.id, { notes: file.notes })}
                            placeholder="Add notes…"
                            className="
                              w-full
                              text-xs
                              text-slate-700
                              border
                              border-slate-200
                              rounded-md
                              p-2
                              resize-y
                              min-h-[3rem]
                              max-h-[16rem]
                              focus:ring-2
                              focus:ring-indigo-500
                            "
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={file.checkedByPhoebe}
                            onChange={() => toggleCheck(file.id, 'phoebe')}
                            className="h-5 w-5 rounded-full border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer transition-all hover:scale-110"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={file.checkedByJay}
                            onChange={() => toggleCheck(file.id, 'jay')}
                            className="h-5 w-5 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer transition-all hover:scale-110"
                          />
                        </td>
                        <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => {
                              console.log('IMAGE URL:', file.imageUrl);
                              setPreviewImage(file.imageUrl ?? null);
                            }}
                            className="inline-flex p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            title="View original image"
                            >
                              <EyeIcon className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => downloadSingle(file)}
                            disabled={file.status !== ParseStatus.COMPLETED}
                            className="inline-flex p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Download CSV"
                          >
                            <ArrowDownTrayIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setEditingFile(file)}
                            className="inline-flex p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            title="Edit CSV"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => removeFile(file.id)}
                            className="inline-flex p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                            title="Remove record"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center text-slate-400 text-sm font-medium">
          <p>© 2024 FuelScan Systems • Gemini AI Enhanced OCR</p>
          <div className="flex space-x-6">
            <span className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 shadow-sm animate-pulse"></div> System Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center transition-transform hover:-translate-y-1 duration-300">
    <div className="p-3 rounded-xl bg-slate-50 mr-4 border border-slate-100">
      {icon}
    </div>
    <div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: ParseStatus; error?: string }> = ({ status, error }) => {
  switch (status) {
    case ParseStatus.PROCESSING:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
          <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3 text-amber-800" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Parsing
        </span>
      );
    case ParseStatus.COMPLETED:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
          Done
        </span>
      );
    case ParseStatus.FAILED:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 cursor-help" title={error}>
          Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
          Idle
        </span>
      );
  }
};

export default App;
