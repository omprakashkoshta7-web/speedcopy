import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PDFDocument } from 'pdf-lib';
import Navbar from '../components/Navbar';
import productService from '../services/product.service';
import orderService from '../services/order.service';
import { useAuth } from '../context/AuthContext';
import fileStorageService from '../services/fileStorage.service';

type CounterProps = { value: number; onChange: (v: number) => void };
type DropdownProps = { label: string; options: string[]; value: string; onChange: (v: string) => void };

const Counter: React.FC<CounterProps> = ({ value, onChange }) => (
  <div className="flex items-center gap-3">
    <button onClick={() => onChange(Math.max(1, value - 1))}
      className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-gray-700 transition"
      style={{ backgroundColor: '#111111' }}>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
      </svg>
    </button>
    <span className="font-bold text-gray-900 w-6 text-center" style={{ fontSize: '15px' }}>
      {String(value).padStart(2, '0')}
    </span>
    <button onClick={() => onChange(value + 1)}
      className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-gray-700 transition"
      style={{ backgroundColor: '#111111' }}>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  </div>
);

const Dropdown: React.FC<DropdownProps> = ({ label, options, value, onChange }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mb-4">
      <p className="font-semibold text-gray-700 mb-1.5 px-1" style={{ fontSize: '13px' }}>{label}</p>
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <button onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
          style={{ borderBottom: open ? '1px solid #f3f4f6' : 'none' }}>
          <span className="text-sm" style={{ color: value ? '#111111' : '#9ca3af', fontWeight: value ? 600 : 400 }}>
            {value || 'Select Input'}
          </span>
        </button>
        {open && options.map(opt => (
          <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition flex items-center justify-between"
            style={{ color: value === opt ? '#111111' : '#374151', fontWeight: value === opt ? 700 : 400, borderBottom: '1px solid #f9fafb' }}>
            {opt}
            {value === opt && (
              <svg className="w-4 h-4" style={{ color: '#111111' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

const PrintConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const printType = searchParams.get('type') || 'standard';
  const productId = searchParams.get('product') || '';

  const [copies, setCopies] = useState(1);
  const [linearSheets, setLinearSheets] = useState(0);
  const [semiLog, setSemiLog] = useState(0);
  const [colorMode, setColorMode] = useState('');
  const [pageSize, setPageSize] = useState('');
  const [printSide, setPrintSide] = useState('');
  const [selectedPrintType] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [bindingType, setBindingType] = useState('');
  const [coverPage, setCoverPage] = useState('');

  // Pricing configuration
  const pricingConfig = {
    basePrice: {
      'B&W': { 'A4': 2, 'A3': 4 },
      'color': { 'A4': 5, 'A3': 8 },
      'Custom': { 'A4': 3, 'A3': 6 }
    },
    printSideMultiplier: {
      'one-sided': 1,
      'Two-sided': 1.5,
      '4 in 1 (2 front+2 Back)': 0.8
    },
    graphSheetPrice: 3, // per sheet
    processingFee: 5,
    bindingPrice: {
      'None': 0,
      'Soft Binding': 15,
      'Spiral Binding': 25,
      'Thesis Binding': 50
    },
    coverPagePrice: {
      'None': 0,
      'Transparent': 5,
      'Colored': 10,
      'Leather-finish': 20
    }
  };

  // Calculate total price based on selections
  const calculatePrice = () => {
    let total = 0;
    
    // Base printing cost
    if (colorMode && pageSize) {
      const baseRate = pricingConfig.basePrice[colorMode as keyof typeof pricingConfig.basePrice]?.[pageSize as 'A4' | 'A3'] || 0;
      const sideMultiplier = pricingConfig.printSideMultiplier[printSide as keyof typeof pricingConfig.printSideMultiplier] || 1;
      
      // Estimate pages from uploaded files (assuming 1 page per file if not specified)
      const totalPages = uploadedFiles.reduce((sum, file) => sum + (file.pages || 1), 0);
      
      total += baseRate * totalPages * copies * sideMultiplier;
    }
    
    // Graph sheets cost
    if (linearSheets > 0 || semiLog > 0) {
      total += (linearSheets + semiLog) * pricingConfig.graphSheetPrice;
    }
    
    // Binding cost
    if (bindingType) {
      total += pricingConfig.bindingPrice[bindingType as keyof typeof pricingConfig.bindingPrice] || 0;
    }
    
    // Cover page cost
    if (coverPage) {
      total += pricingConfig.coverPagePrice[coverPage as keyof typeof pricingConfig.coverPagePrice] || 0;
    }
    
    // Processing fee
    total += pricingConfig.processingFee;
    
    return total;
  };

  const totalPrice = calculatePrice();

  React.useEffect(() => {
    fetchUploadedFiles();
  }, []);

  // Reload files when page becomes visible (user returns from editor)
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page visible, reloading uploaded files...');
        fetchUploadedFiles();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchUploadedFiles = async () => {
    try {
      setFilesLoading(true);
      
      // Initialize IndexedDB
      await fileStorageService.init();
      
      // Try to migrate from localStorage if needed
      await fileStorageService.migrateFromLocalStorage();
      
      // Get files from IndexedDB
      const files = await fileStorageService.getAllFiles();
      
      if (files.length > 0) {
        console.log(`✅ Loaded ${files.length} files from IndexedDB`);
        setUploadedFiles(files);
        return;
      }
      
      // If no files in IndexedDB, try API
      try {
        const response = await productService.getUploadedFiles();
        const apiFiles = response.data || [];
        if (apiFiles.length > 0) {
          setUploadedFiles(apiFiles);
          // Save to IndexedDB for offline access
          for (const file of apiFiles) {
            await fileStorageService.saveFile(file);
          }
          return;
        }
      } catch (_apiErr) {
        console.log('API not available, using IndexedDB only');
      }
      
      setUploadedFiles([]);
    } catch (error) {
      console.error('Error fetching files:', error);
      setUploadedFiles([]);
    } finally {
      setFilesLoading(false);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: any[] = [];
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size (warn if > 10MB)
      if (file.size > 10 * 1024 * 1024) {
        const proceed = confirm(`File "${file.name}" is large (${(file.size / 1024 / 1024).toFixed(2)}MB). This may take time to process. Continue?`);
        if (!proceed) continue;
      }
      
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          let pageCount = 1;
          let fileData: any;
          
          // For PDF files, count pages
          if (file.type === 'application/pdf') {
            try {
              const arrayBuffer = e.target?.result as ArrayBuffer;
              console.log(`📄 Processing PDF: ${file.name}, size: ${file.size} bytes`);
              
              const pdfDoc = await PDFDocument.load(arrayBuffer);
              pageCount = pdfDoc.getPageCount();
              
              console.log(`✅ PDF "${file.name}" has ${pageCount} pages`);
              
              // Store PDF as base64 for smaller size
              const base64 = btoa(
                new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
              );
              
              fileData = {
                id: `${Date.now()}_${i}`,
                name: file.name,
                size: file.size,
                pages: pageCount,
                uploadedAt: new Date().toISOString(),
                mimetype: file.type,
                data: `data:application/pdf;base64,${base64}`,
              };
              
              console.log(`📦 File data created:`, { name: fileData.name, pages: fileData.pages, size: fileData.size });
            } catch (err) {
              console.error('❌ PDF processing error:', err);
              console.error('File details:', { name: file.name, type: file.type, size: file.size });
              alert(`Failed to process PDF: ${file.name}. Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
              resolve();
              return;
            }
          } 
          // For image files, compress them
          else if (file.type.startsWith('image/')) {
            try {
              const dataUrl = e.target?.result as string;
              // Compress image to reduce storage
              const compressed = await fileStorageService.compressImage(dataUrl, 1200, 0.8);
              
              fileData = {
                id: `${Date.now()}_${i}`,
                name: file.name,
                size: compressed.length, // Use compressed size
                pages: 1,
                uploadedAt: new Date().toISOString(),
                mimetype: 'image/jpeg', // Convert to JPEG
                data: compressed,
              };
            } catch (err) {
              console.error('Image compression error:', err);
              alert(`Failed to process image: ${file.name}`);
              resolve();
              return;
            }
          }
          // For other files
          else {
            fileData = {
              id: `${Date.now()}_${i}`,
              name: file.name,
              size: file.size,
              pages: 1,
              uploadedAt: new Date().toISOString(),
              mimetype: file.type,
              data: e.target?.result,
            };
          }
          
          newFiles.push(fileData);
          resolve();
        };
        
        // Read as appropriate format
        if (file.type === 'application/pdf') {
          reader.readAsArrayBuffer(file);
        } else {
          reader.readAsDataURL(file);
        }
      });
    }
    
    // Update state with all processed files
    setUploadedFiles(prev => {
      const updated = [...prev, ...newFiles];
      
      // Log the files being added
      console.log(`📋 Adding ${newFiles.length} files to state:`);
      newFiles.forEach(f => {
        console.log(`  - ${f.name}: ${f.pages} pages`);
      });
      console.log(`📊 Total files after upload: ${updated.length}`);
      console.log(`📊 Total pages: ${updated.reduce((sum, file) => sum + (file.pages || 1), 0)}`);
      
      // Save to IndexedDB instead of localStorage
      (async () => {
        try {
          for (const file of newFiles) {
            await fileStorageService.saveFile(file);
          }
          console.log(`✅ Saved ${newFiles.length} files to IndexedDB`);
        } catch (error) {
          console.error('Failed to save files to IndexedDB:', error);
          alert('Warning: Files may not be saved permanently. Storage limit may be reached.');
        }
      })();
      return updated;
    });

    // Also try to upload to backend
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      await productService.uploadFiles(formData);
    } catch (err: any) {
      console.log('Backend upload failed, using local storage:', err.message);
    }
  };

  const handleBrowseClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt';
    input.onchange = (e: any) => handleFileSelect(e.target.files);
    input.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDeleteFile = (fileId: string) => {
    setUploadedFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      // Delete from IndexedDB
      fileStorageService.deleteFile(fileId).catch(err => 
        console.error('Failed to delete file from IndexedDB:', err)
      );
      return updated;
    });
  };

  const buildConfigPayload = () => ({
    productId: productId || undefined,
    printType,
    options: { copies, colorMode, pageSize, printSide, selectedPrintType, linearSheets, semiLog, bindingType, coverPage },
    specialInstructions: instructions,
  });

  const handleAddToCart = async () => {
    if (!isAuthenticated) { navigate('/'); return; }
    setLoading(true);
    setError('');
    try {
      const configResponse = await productService.saveBusinessPrintConfig(buildConfigPayload());
      const configId = configResponse.data?._id || configResponse.data?.configId;
      await orderService.addToCart({
        productId: productId || 'print-config',
        quantity: copies,
        options: { configId, printType },
      });
      navigate('/cart');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add to cart. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToPay = async () => {
    setLoading(true);
    setError('');
    try {
      // Create config object with current selections
      const configData = {
        copies,
        colorMode,
        pageSize,
        printSide,
        linearSheets,
        semiLog,
        bindingType,
        coverPage,
        uploadedFiles,
        totalPages: uploadedFiles.reduce((sum, file) => sum + (file.pages || 1), 0),
        instructions,
        printType
      };

      if (isAuthenticated) {
        const configResponse = await productService.saveBusinessPrintConfig(buildConfigPayload());
        const configId = configResponse.data?._id || configResponse.data?.configId;
        
        // Save config to localStorage for checkout page
        localStorage.setItem(`printConfig_${configId}`, JSON.stringify(configData));
        
        // Skip service package page and go directly to pickup location
        navigate(`/pickup-location?configId=${configId}&type=${printType}`);
      } else {
        // Not logged in — save config with temporary ID
        const tempConfigId = `temp_${Date.now()}`;
        localStorage.setItem(`printConfig_${tempConfigId}`, JSON.stringify(configData));
        // Skip service package page and go directly to pickup location
        navigate(`/pickup-location?configId=${tempConfigId}&type=${printType}`);
      }
    } catch {
      // Even if save fails, proceed to pickup location with temp config
      const tempConfigId = `temp_${Date.now()}`;
      const configData = {
        copies,
        colorMode,
        pageSize,
        printSide,
        linearSheets,
        semiLog,
        bindingType,
        coverPage,
        uploadedFiles,
        totalPages: uploadedFiles.reduce((sum, file) => sum + (file.pages || 1), 0),
        instructions,
        printType
      };
      localStorage.setItem(`printConfig_${tempConfigId}`, JSON.stringify(configData));
      // Skip service package page and go directly to pickup location
      navigate(`/pickup-location?configId=${tempConfigId}&type=${printType}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Back Button */}
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4 font-semibold"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left */}
          <div className="w-full lg:w-1/2">
            {/* Upload zone */}
            <div className="bg-white rounded-2xl p-8 mb-4 flex flex-col items-center justify-center text-center overflow-hidden"
              style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minHeight: '200px', position: 'relative' }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: 'url("https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800&q=80")',
                backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.12, zIndex: 0,
              }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <p className="font-bold text-gray-900 mb-1" style={{ fontSize: '15px' }}>Drag & drop more files</p>
                <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>or click to browse your computer</p>
                <div className="flex gap-2 justify-center">
                  <button onClick={handleBrowseClick} type="button"
                    className="px-6 py-2.5 text-white font-bold rounded-full hover:bg-gray-700 transition text-sm" style={{ backgroundColor: '#111111' }}>
                    Browse Files
                  </button>
                  <button 
                    onClick={() => {
                      // Navigate to document editor (new dedicated editor for documents)
                      navigate('/document-editor?type=document');
                    }}
                    type="button"
                    className="px-6 py-2.5 font-bold rounded-full hover:bg-orange-600 transition text-sm text-white" 
                    style={{ backgroundColor: '#ff6a3d' }}
                  >
                    Design with Canvas Editor
                  </button>
                </div>
              </div>
            </div>

            {/* Uploaded Files */}
            <div className="bg-white rounded-2xl p-4 mb-4" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-gray-900" style={{ fontSize: '14px' }}>
                  Uploaded Files <span className="text-gray-400 font-normal">({uploadedFiles.length})</span>
                </p>
                {uploadedFiles.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg" style={{ backgroundColor: '#eff6ff' }}>
                    <svg className="w-4 h-4" style={{ color: '#3b82f6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs font-bold" style={{ color: '#1e40af' }}>
                      Total: {uploadedFiles.reduce((sum, file) => sum + (file.pages || 1), 0)} pages
                    </span>
                  </div>
                )}
              </div>
              {filesLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                </div>
              ) : uploadedFiles.length > 0 ? (
                <div className="space-y-2">
                  {uploadedFiles.map((file: any) => (
                    <div key={file.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ border: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: file.mimetype === 'application/pdf' ? '#ef444420' : '#3b82f620' }}>
                        <svg className="w-4 h-4" style={{ color: file.mimetype === 'application/pdf' ? '#ef4444' : '#3b82f6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 truncate" style={{ fontSize: '12px' }}>{file.name}</p>
                        <p style={{ fontSize: '11px', color: '#9ca3af' }}>
                          {file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'N/A'} • 
                          <span className="font-bold" style={{ color: file.pages > 1 ? '#3b82f6' : '#9ca3af' }}>
                            {' '}{file.pages || 1} {file.pages === 1 ? 'page' : 'pages'}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-50 transition"
                        style={{ color: '#ef4444' }}
                        title="Delete file">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No files uploaded yet</p>
              )}
            </div>

            {/* Counters */}
            <div className="bg-white rounded-2xl px-4 py-2" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
                <span className="text-sm font-medium text-gray-700">Number of copies</span>
                <Counter value={copies} onChange={setCopies} />
              </div>
              
              {/* Graph Sheets - Optional Section */}
              <div className="py-3">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Optional Add-ons</p>
                <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <span className="text-sm font-medium text-gray-700">Linear Graph Sheets</span>
                  <Counter value={linearSheets} onChange={setLinearSheets} />
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-gray-700">Semi Log Graph sheets</span>
                  <Counter value={semiLog} onChange={setSemiLog} />
                </div>
                {(linearSheets > 0 || semiLog > 0) && (
                  <p className="text-xs text-green-600 mt-2">✓ Graph sheets will be added to your order</p>
                )}
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="w-full lg:w-1/2">
            <Dropdown label="Color Mode" options={['B&W', 'color', 'Custom']} value={colorMode} onChange={setColorMode} />
            <Dropdown label="Page size" options={['A4', 'A3']} value={pageSize} onChange={setPageSize} />
            <Dropdown label="Print Side" options={['one-sided', 'Two-sided', '4 in 1 (2 front+2 Back)']} value={printSide} onChange={setPrintSide} />
            
            {/* Binding Type */}
            <Dropdown label="Binding Type" options={['None', 'Soft Binding', 'Spiral Binding', 'Thesis Binding']} value={bindingType} onChange={setBindingType} />
            
            {/* Cover Page - Only show if binding type is selected and not "None" */}
            {bindingType && bindingType !== 'None' && (
              <Dropdown label="Cover Page" options={['None', 'Transparent', 'Colored', 'Leather-finish']} value={coverPage} onChange={setCoverPage} />
            )}

            {/* Special Instructions */}
            <div className="mb-4">
              <p className="font-semibold text-gray-700 mb-1.5 px-1" style={{ fontSize: '13px' }}>Special Instructions</p>
              <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                  placeholder="Type your instruction here" rows={4}
                  className="w-full px-4 py-3 rounded-2xl text-sm focus:outline-none resize-none"
                  style={{ border: '1px solid #e5e7eb', color: '#374151', backgroundColor: '#fafafa' }} />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              {error && <p className="text-sm font-medium text-center" style={{ color: '#ef4444' }}>{error}</p>}
              <div className="flex items-center gap-3">
                <button onClick={handleAddToCart} disabled={loading}
                  className="flex-1 py-3 font-bold rounded-full hover:bg-gray-100 transition text-sm disabled:opacity-60"
                  style={{ border: '1.5px solid #e5e7eb', color: '#374151', backgroundColor: '#fff' }}>
                  {loading ? 'Saving...' : 'Add to cart'}
                </button>
                <button onClick={handleContinueToPay} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-white font-bold rounded-full hover:bg-gray-700 transition text-sm disabled:opacity-60"
                  style={{ backgroundColor: '#111111' }}>
                  {loading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <>
                      Continue to Pay
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              {/* Dynamic Price Display */}
              {(colorMode || pageSize || printSide || uploadedFiles.length > 0) && (
                <div className="bg-white rounded-2xl p-4 mt-2" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900" style={{ fontSize: '14px' }}>Price Breakdown</h3>
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-semibold text-green-600">Live Pricing</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {/* Printing Cost */}
                    {colorMode && pageSize && uploadedFiles.length > 0 && (
                      <div className="flex justify-between items-center">
                        <span style={{ color: '#6b7280' }}>
                          Printing ({uploadedFiles.reduce((sum, file) => sum + (file.pages || 1), 0)} pages × {copies} copies)
                        </span>
                        <span className="font-semibold text-gray-900">
                          ₹{(() => {
                            const baseRate = pricingConfig.basePrice[colorMode as keyof typeof pricingConfig.basePrice]?.[pageSize as 'A4' | 'A3'] || 0;
                            const sideMultiplier = pricingConfig.printSideMultiplier[printSide as keyof typeof pricingConfig.printSideMultiplier] || 1;
                            const totalPages = uploadedFiles.reduce((sum, file) => sum + (file.pages || 1), 0);
                            return (baseRate * totalPages * copies * sideMultiplier).toFixed(2);
                          })()}
                        </span>
                      </div>
                    )}

                    {/* Graph Sheets */}
                    {(linearSheets > 0 || semiLog > 0) && (
                      <div className="flex justify-between items-center">
                        <span style={{ color: '#6b7280' }}>
                          Graph Sheets ({linearSheets + semiLog} sheets)
                        </span>
                        <span className="font-semibold text-gray-900">
                          ₹{((linearSheets + semiLog) * pricingConfig.graphSheetPrice).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Processing Fee */}
                    <div className="flex justify-between items-center">
                      <span style={{ color: '#6b7280' }}>Processing Fee</span>
                      <span className="font-semibold text-gray-900">₹{pricingConfig.processingFee.toFixed(2)}</span>
                    </div>

                    {/* Configuration Details */}
                    {(colorMode || pageSize || printSide) && (
                      <div className="pt-2 mt-2" style={{ borderTop: '1px solid #f3f4f6' }}>
                        <div className="flex flex-wrap gap-2">
                          {colorMode && (
                            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                              {colorMode}
                            </span>
                          )}
                          {pageSize && (
                            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#f0fdf4', color: '#166534' }}>
                              {pageSize}
                            </span>
                          )}
                          {printSide && (
                            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                              {printSide}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex justify-between items-center pt-3 mt-3" style={{ borderTop: '2px solid #f3f4f6' }}>
                      <span className="font-bold text-gray-900">Total Amount</span>
                      <span className="font-bold text-gray-900" style={{ fontSize: '18px', color: '#111111' }}>
                        ₹{totalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Price Note */}
                  <div className="mt-3 p-2 rounded-lg" style={{ backgroundColor: '#eff6ff' }}>
                    <p className="text-xs" style={{ color: '#1e40af' }}>
                      💡 Price updates automatically based on your selections. Final price may vary based on actual file complexity.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PrintConfigPage;
