import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import productService from '../services/product.service';
import orderService from '../services/order.service';
import { useAuth } from '../context/AuthContext';

// Google Fonts to load
const FONTS = [
  { name: 'Roboto', label: 'Roboto' },
  { name: 'Playfair Display', label: 'Playfair Display' },
  { name: 'Pacifico', label: 'Pacifico' },
  { name: 'Dancing Script', label: 'Dancing Script' },
  { name: 'Montserrat', label: 'Montserrat' },
  { name: 'Lato', label: 'Lato' },
  { name: 'Oswald', label: 'Oswald' },
  { name: 'Lobster', label: 'Lobster' },
  { name: 'Raleway', label: 'Raleway' },
  { name: 'Great Vibes', label: 'Great Vibes' },
];

interface UserText {
  id: string;
  text: string;
  font: string;
  size: number;
  color: string;
  x: number;
  y: number;
  bold: boolean;
  italic: boolean;
}

interface ProductRecord {
  _id?: string;
  id?: string;
  name?: string;
  thumbnail?: string;
  image?: string;
  images?: string[];
  basePrice?: number;
  discountedPrice?: number;
  mrp?: number;
  sale_price?: number;
}

interface UserPhoto {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
}

interface SavedDesign {
  id: string;
  name: string;
  productId: string;
  productName: string;
  thumbnail: string;       // base64 preview
  photos: UserPhoto[];
  activeImageIndex: number;
  savedAt: string;
}

const SimpleFrameEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ photoId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [userPhotos, setUserPhotos] = useState<UserPhoto[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([]);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Text layer state
  const [userTexts, setUserTexts] = useState<UserText[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [newTextInput, setNewTextInput] = useState('');
  const [selectedFont, setSelectedFont] = useState('Roboto');
  const [textSize, setTextSize] = useState(24);
  const [textColor, setTextColor] = useState('#111111');
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const textDragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const productId = searchParams.get('productId');

  const salePrice = product?.sale_price ?? product?.discountedPrice ?? product?.basePrice ?? 0;
  const mrp = product?.mrp ?? product?.basePrice ?? salePrice;
  const displayPrice = salePrice || mrp || 0;

  const selectedPhoto = userPhotos.find(p => p.id === selectedPhotoId) || null;

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    void init();
    loadSavedDesigns();
    loadGoogleFonts();
  }, []); // eslint-disable-line

  const loadGoogleFonts = () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${FONTS.map(f => `family=${f.name.replace(/ /g, '+')}:wght@400;700`).join('&')}&display=swap`;
    document.head.appendChild(link);
  };

  // ── Saved Designs (localStorage) ─────────────────────────────────────────
  const STORAGE_KEY = 'speedcopy_saved_designs';

  const loadSavedDesigns = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedDesigns(JSON.parse(raw));
    } catch { /* ignore */ }
  };

  const saveDesign = async () => {
    if (!product) return;

    // Generate thumbnail from editor
    let thumbnail = productImages[activeImageIndex] || '';
    try {
      const { default: html2canvas } = await import('html2canvas');
      if (editorRef.current) {
        const canvas = await html2canvas(editorRef.current, { useCORS: true, allowTaint: true, scale: 0.4 });
        const maxW = 400;
        const ratio = Math.min(maxW / canvas.width, 1);
        const resized = document.createElement('canvas');
        resized.width = Math.round(canvas.width * ratio);
        resized.height = Math.round(canvas.height * ratio);
        const ctx = resized.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, 0, resized.width, resized.height);
          thumbnail = resized.toDataURL('image/jpeg', 0.5);
        }
      }
    } catch { /* use product image as fallback */ }

    const design: SavedDesign = {
      id: `design_${Date.now()}`,
      name: `${product.name || 'Design'} - ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
      productId: (product._id || product.id || productId || ''),
      productName: product.name || 'Design',
      thumbnail,
      photos: userPhotos,
      activeImageIndex,
      savedAt: new Date().toISOString(),
    };

    const updated = [design, ...savedDesigns].slice(0, 20); // max 20 designs
    setSavedDesigns(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSaveMsg('Design saved!');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const loadDesign = (design: SavedDesign) => {
    setUserPhotos(design.photos);
    setActiveImageIndex(design.activeImageIndex);
    setSelectedPhotoId(null);
    setShowSavedPanel(false);
  };

  const deleteDesign = (id: string) => {
    const updated = savedDesigns.filter(d => d.id !== id);
    setSavedDesigns(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // ── Text layer functions ──────────────────────────────────────────────────
  const addText = () => {
    if (!newTextInput.trim()) return;
    const editorW = editorRef.current?.clientWidth || 600;
    const editorH = editorRef.current?.clientHeight || 500;
    const txt: UserText = {
      id: `text_${Date.now()}`,
      text: newTextInput.trim(),
      font: selectedFont,
      size: textSize,
      color: textColor,
      x: editorW / 2 - 80,
      y: editorH / 2 - 20,
      bold: textBold,
      italic: textItalic,
    };
    setUserTexts(prev => [...prev, txt]);
    setSelectedTextId(txt.id);
    setNewTextInput('');
  };

  const onTextMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedTextId(id);
    setSelectedPhotoId(null);
    const txt = userTexts.find(t => t.id === id);
    if (!txt) return;
    textDragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: txt.x, origY: txt.y };
    const onMove = (ev: MouseEvent) => {
      if (!textDragRef.current) return;
      const dx = ev.clientX - textDragRef.current.startX;
      const dy = ev.clientY - textDragRef.current.startY;
      setUserTexts(prev => prev.map(t =>
        t.id === textDragRef.current!.id
          ? { ...t, x: textDragRef.current!.origX + dx, y: textDragRef.current!.origY + dy }
          : t
      ));
    };
    const onUp = () => {
      textDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const updateSelectedText = (changes: Partial<UserText>) => {
    if (!selectedTextId) return;
    setUserTexts(prev => prev.map(t => t.id === selectedTextId ? { ...t, ...changes } : t));
  };

  const deleteText = (id: string) => {
    setUserTexts(prev => prev.filter(t => t.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  const selectedText = userTexts.find(t => t.id === selectedTextId) || null;

  // ── Submit for Review ─────────────────────────────────────────────────────
  const submitForReview = async () => {
    if (userPhotos.length === 0) {
      alert('Please upload a photo before submitting for review.');
      return;
    }
    setReviewSubmitting(true);
    try {
      // Generate composite thumbnail
      let previewImage = productImages[activeImageIndex] || '';
      try {
        const { default: html2canvas } = await import('html2canvas');
        if (editorRef.current) {
          const canvas = await html2canvas(editorRef.current, { useCORS: true, allowTaint: true, scale: 0.4 });
          const maxW = 400;
          const ratio = Math.min(maxW / canvas.width, 1);
          const resized = document.createElement('canvas');
          resized.width = Math.round(canvas.width * ratio);
          resized.height = Math.round(canvas.height * ratio);
          const ctx = resized.getContext('2d');
          if (ctx) {
            ctx.drawImage(canvas, 0, 0, resized.width, resized.height);
            previewImage = resized.toDataURL('image/jpeg', 0.5);
          }
        }
      } catch { /* use product image */ }

      // Save review submission to localStorage
      const reviewKey = 'speedcopy_review_submissions';
      const existing = JSON.parse(localStorage.getItem(reviewKey) || '[]');
      const submission = {
        id: `review_${Date.now()}`,
        productId: (product?._id || product?.id || productId || ''),
        productName: product?.name || 'Design',
        previewImage,
        note: reviewNote,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      };
      localStorage.setItem(reviewKey, JSON.stringify([submission, ...existing].slice(0, 50)));

      setReviewSubmitted(true);
      setReviewNote('');
    } catch (e) {
      console.error('Review submission failed:', e);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const init = async () => {
    try {
      if (!productId) { navigate('/gifting'); return; }
      setLoading(true);

      let data: ProductRecord | null = null;
      try {
        const r = await productService.getGiftingProductById(productId);
        data = (r?.data || r) as ProductRecord;
      } catch {
        const r = await productService.getProductById(productId);
        data = (r?.data || r) as ProductRecord;
      }
      setProduct(data || null);

      const imgs: string[] = [];
      if (Array.isArray(data?.images) && data!.images.length > 0) imgs.push(...data!.images);
      else if (data?.thumbnail) imgs.push(data.thumbnail);
      else if (data?.image) imgs.push(data.image);
      setProductImages(imgs);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // ── Upload photo ──────────────────────────────────────────────────────────
  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    for (const file of Array.from(files)) {
      const dataUrl = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(String(reader.result));
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      // Get natural dimensions
      const dims = await new Promise<{ w: number; h: number }>((res) => {
        const img = new Image();
        img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => res({ w: 300, h: 300 });
        img.src = dataUrl;
      });

      // Default size: 40% of editor width
      const editorW = editorRef.current?.clientWidth || 600;
      const editorH = editorRef.current?.clientHeight || 500;
      const maxW = editorW * 0.45;
      const maxH = editorH * 0.45;
      const scale = Math.min(maxW / dims.w, maxH / dims.h, 1);
      const w = dims.w * scale;
      const h = dims.h * scale;

      const photo: UserPhoto = {
        id: `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        dataUrl,
        x: (editorW - w) / 2,
        y: (editorH - h) / 2,
        width: dims.w,
        height: dims.h,
        scale,
        rotation: 0,
      };

      setUserPhotos(prev => [...prev, photo]);
      setSelectedPhotoId(photo.id);
    }
  };

  // ── Drag to move ──────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent, photoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPhotoId(photoId);
    const photo = userPhotos.find(p => p.id === photoId);
    if (!photo) return;
    dragRef.current = { photoId, startX: e.clientX, startY: e.clientY, origX: photo.x, origY: photo.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setUserPhotos(prev => prev.map(p =>
        p.id === dragRef.current!.photoId
          ? { ...p, x: dragRef.current!.origX + dx, y: dragRef.current!.origY + dy }
          : p
      ));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Scale selected ────────────────────────────────────────────────────────
  const scalePhoto = (factor: number) => {
    if (!selectedPhotoId) return;
    setUserPhotos(prev => prev.map(p =>
      p.id === selectedPhotoId ? { ...p, scale: Math.max(0.05, p.scale * factor) } : p
    ));
  };

  const fitPhoto = () => {
    if (!selectedPhotoId || !editorRef.current) return;
    const editorW = editorRef.current.clientWidth;
    const editorH = editorRef.current.clientHeight;
    setUserPhotos(prev => prev.map(p => {
      if (p.id !== selectedPhotoId) return p;
      const scale = Math.min((editorW * 0.7) / p.width, (editorH * 0.7) / p.height);
      const w = p.width * scale;
      const h = p.height * scale;
      return { ...p, scale, x: (editorW - w) / 2, y: (editorH - h) / 2 };
    }));
  };

  const deletePhoto = (id: string) => {
    setUserPhotos(prev => prev.filter(p => p.id !== id));
    if (selectedPhotoId === id) setSelectedPhotoId(null);
  };

  // ── Download ──────────────────────────────────────────────────────────────
  const downloadDesign = async () => {
    if (!editorRef.current) return;

    // Use html2canvas if available, else just download product image
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(editorRef.current, { useCORS: true, allowTaint: true, scale: 2 });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${product?.name || 'design'}.png`;
      link.click();
    } catch {
      alert('Download failed. Please take a screenshot.');
    }
  };

  // ── Add to cart ───────────────────────────────────────────────────────────
  const addToCart = async () => {
    if (!isAuthenticated) {
      alert('Please login to add items to cart');
      navigate('/');
      return;
    }
    if (!product) {
      alert('Product not loaded. Please refresh.');
      return;
    }

    try {
      const pid = (product._id || product.id || productId || '').toString();
      if (!pid) {
        alert('Product ID missing. Please go back and try again.');
        return;
      }

      // Generate composite screenshot (frame + user photo) for cart display
      let designPreview = productImages[activeImageIndex] || '';
      try {
        const { default: html2canvas } = await import('html2canvas');
        if (editorRef.current) {
          const canvas = await html2canvas(editorRef.current, {
            useCORS: true,
            allowTaint: true,
            scale: 0.4,   // low scale to keep size small
          });
          // Resize to max 400px wide
          const maxW = 400;
          const ratio = Math.min(maxW / canvas.width, 1);
          const resized = document.createElement('canvas');
          resized.width = Math.round(canvas.width * ratio);
          resized.height = Math.round(canvas.height * ratio);
          const ctx = resized.getContext('2d');
          if (ctx) {
            ctx.drawImage(canvas, 0, 0, resized.width, resized.height);
            designPreview = resized.toDataURL('image/jpeg', 0.5); // heavy compression
          }
        }
      } catch {
        // fallback to product image
      }

      const payload = {
        productId: pid,
        productName: product.name || 'Design',
        flowType: 'gifting' as const,
        quantity,
        unitPrice: displayPrice,
        totalPrice: displayPrice * quantity,
        variantId: undefined as undefined,
        designId: `simple-${pid}-${Date.now()}`,
        thumbnail: designPreview,
        designPreview: designPreview,
        designJson: '',
        designName: `${product.name || 'Design'} - Editor`,
        options: { source: 'simple-frame-editor' },
      };

      console.log('🛒 Adding to cart with composite design preview');

      await orderService.addToCart(payload);
      console.log('✅ Added to cart successfully');
      navigate('/cart');
    } catch (e: any) {
      console.error('❌ Add to cart failed:', e);
      const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Failed to add to cart';
      alert(`Error: ${msg}`);
    }
  };

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
        <p className="mt-4 text-gray-600">Loading editor...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg p-8 text-center shadow-lg max-w-md">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => navigate(-1)} className="bg-gray-800 text-white px-6 py-2 rounded-lg">Go Back</button>
      </div>
    </div>
  );

  const activeProductImage = productImages[activeImageIndex] || '';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { void handleUpload(e.target.files); e.currentTarget.value = ''; }} />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 text-sm">← Back</button>
            <div>
              <h1 className="text-base font-bold text-gray-900">Design Editor</h1>
              <p className="text-xs text-gray-500">{product?.name || 'Product'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-base font-bold text-orange-600">₹{displayPrice.toFixed(2)}</p>
              {mrp > displayPrice && <p className="text-xs text-gray-400 line-through">₹{mrp.toFixed(2)}</p>}
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-7 h-7 rounded bg-white flex items-center justify-center font-bold text-gray-600 text-sm">−</button>
              <span className="w-7 text-center text-sm font-semibold">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="w-7 h-7 rounded bg-white flex items-center justify-center font-bold text-gray-600 text-sm">+</button>
            </div>
            <button onClick={saveDesign} className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save
              {saveMsg && <span className="text-green-600 text-xs font-semibold">{saveMsg}</span>}
            </button>
            <button
              onClick={() => { setShowReviewModal(true); setReviewSubmitted(false); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
              style={{ backgroundColor: '#111111', color: '#ffffff' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ready for Review
            </button>
            <button
              onClick={() => setShowSavedPanel(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition flex items-center gap-1.5"
              style={{ border: '1.5px solid #e5e7eb', backgroundColor: '#fff', color: '#374151' }}
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              My Designs
              {savedDesigns.length > 0 && (
                <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {savedDesigns.length}
                </span>
              )}
            </button>
            <button onClick={addToCart} className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600">Add To Cart</button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Panel */}
        <div className="w-60 bg-white border-r border-gray-200 flex flex-col overflow-y-auto flex-shrink-0">

          {/* Upload */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Add Your Photo</h3>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-orange-300 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition"
            >
              <span className="text-3xl">📁</span>
              <span className="text-sm font-semibold text-orange-600">Upload Image</span>
              <span className="text-xs text-gray-400">JPG, PNG, WEBP</span>
            </button>
          </div>

          {/* Uploaded photos */}
          {userPhotos.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Your Photos ({userPhotos.length})</h3>
              <div className="grid grid-cols-2 gap-2">
                {userPhotos.map(photo => (
                  <div key={photo.id} className="relative group">
                    <button
                      onClick={() => setSelectedPhotoId(photo.id)}
                      className={`w-full aspect-square rounded-lg overflow-hidden border-2 transition ${selectedPhotoId === photo.id ? 'border-orange-500' : 'border-gray-200 hover:border-orange-300'}`}
                    >
                      <img src={photo.dataUrl} alt="upload" className="w-full h-full object-cover" />
                    </button>
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adjust controls */}
          {selectedPhoto && (
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Adjust Photo</h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button onClick={() => scalePhoto(0.9)} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-medium hover:bg-gray-200">− Smaller</button>
                  <button onClick={() => scalePhoto(1.1)} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-medium hover:bg-gray-200">+ Larger</button>
                </div>
                <button onClick={fitPhoto} className="w-full py-2 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200">⊡ Fit to Center</button>
                <button onClick={() => deletePhoto(selectedPhoto.id)} className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">Drag photo to reposition</p>
            </div>
          )}

          {/* Text Tool */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Add Text</h3>
            <select value={selectedFont} onChange={e => setSelectedFont(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg text-xs border border-gray-200 mb-2 focus:outline-none"
              style={{ fontFamily: selectedFont }}>
              {FONTS.map(f => (
                <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>{f.label}</option>
              ))}
            </select>
            <div className="flex gap-2 mb-2">
              <input type="number" min={8} max={120} value={textSize}
                onChange={e => setTextSize(Number(e.target.value))}
                className="w-16 px-2 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none text-center" title="Font size" />
              <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)}
                className="w-9 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5" title="Text color" />
              <button onClick={() => setTextBold(b => !b)}
                className={`w-8 h-8 rounded-lg text-xs font-bold border transition ${textBold ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>B</button>
              <button onClick={() => setTextItalic(i => !i)}
                className={`w-8 h-8 rounded-lg text-xs italic border transition ${textItalic ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>I</button>
            </div>
            <div className="flex gap-1.5">
              <input type="text" value={newTextInput} onChange={e => setNewTextInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addText()}
                placeholder="Type text..." style={{ fontFamily: selectedFont }}
                className="flex-1 px-2 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none" />
              <button onClick={addText} disabled={!newTextInput.trim()}
                className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-semibold hover:bg-orange-600 disabled:opacity-40 transition">Add</button>
            </div>
          </div>

          {/* Selected text controls */}
          {selectedText && (
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Edit Text</h3>
              <input type="text" value={selectedText.text}
                onChange={e => updateSelectedText({ text: e.target.value })}
                className="w-full px-2 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none mb-2"
                style={{ fontFamily: selectedText.font }} />
              <select value={selectedText.font} onChange={e => updateSelectedText({ font: e.target.value })}
                className="w-full px-2 py-1.5 rounded-lg text-xs border border-gray-200 mb-2 focus:outline-none"
                style={{ fontFamily: selectedText.font }}>
                {FONTS.map(f => (
                  <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>{f.label}</option>
                ))}
              </select>
              <div className="flex gap-2 mb-2">
                <input type="number" min={8} max={120} value={selectedText.size}
                  onChange={e => updateSelectedText({ size: Number(e.target.value) })}
                  className="w-16 px-2 py-1.5 rounded-lg text-xs border border-gray-200 focus:outline-none text-center" />
                <input type="color" value={selectedText.color}
                  onChange={e => updateSelectedText({ color: e.target.value })}
                  className="w-9 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                <button onClick={() => updateSelectedText({ bold: !selectedText.bold })}
                  className={`w-8 h-8 rounded-lg text-xs font-bold border transition ${selectedText.bold ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>B</button>
                <button onClick={() => updateSelectedText({ italic: !selectedText.italic })}
                  className={`w-8 h-8 rounded-lg text-xs italic border transition ${selectedText.italic ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>I</button>
              </div>
              <button onClick={() => deleteText(selectedText.id)}
                className="w-full py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 flex items-center justify-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove Text
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="p-4">
            <button onClick={downloadDesign} className="w-full py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Design
            </button>
          </div>
        </div>

        {/* Center — Editor Area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 p-6 overflow-auto">
          <p className="text-xs text-gray-500 mb-3">
            {userPhotos.length === 0 ? 'Upload your photo from the left panel' : 'Drag your photo to reposition it'}
          </p>

          {/* Editor container */}
          <div
            ref={editorRef}
            className="relative bg-white shadow-2xl rounded-lg overflow-hidden select-none"
            style={{ width: '600px', height: '500px', cursor: 'default' }}
            onClick={() => setSelectedPhotoId(null)}
          >
            {/* Product image — fills the editor */}
            {activeProductImage ? (
              <img
                src={activeProductImage}
                alt={product?.name || 'Product'}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                crossOrigin="anonymous"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <p className="text-gray-400 text-sm">No product image</p>
              </div>
            )}

            {/* User photos — draggable, on top */}
            {userPhotos.map(photo => {
              const w = photo.width * photo.scale;
              const h = photo.height * photo.scale;
              const isSelected = selectedPhotoId === photo.id;
              return (
                <div
                  key={photo.id}
                  onMouseDown={e => onMouseDown(e, photo.id)}
                  onClick={e => { e.stopPropagation(); setSelectedPhotoId(photo.id); }}
                  style={{
                    position: 'absolute',
                    left: photo.x,
                    top: photo.y,
                    width: w,
                    height: h,
                    cursor: 'move',
                    border: isSelected ? '2px solid #ff6a3d' : '2px solid transparent',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    zIndex: isSelected ? 10 : 5,
                  }}
                >
                  <img
                    src={photo.dataUrl}
                    alt="user photo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '2px' }}
                    draggable={false}
                  />
                  {/* Delete button on selected */}
                  {isSelected && (
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); deletePhoto(photo.id); }}
                      style={{
                        position: 'absolute', top: -10, right: -10,
                        width: 22, height: 22, borderRadius: '50%',
                        background: '#ef4444', color: '#fff',
                        border: 'none', cursor: 'pointer',
                        fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 20,
                      }}
                    >×</button>
                  )}
                  {/* Scale handles on selected */}
                  {isSelected && (
                    <>
                      <div
                        onMouseDown={e => { e.stopPropagation(); scalePhoto(0.9); }}
                        style={{
                          position: 'absolute', bottom: -10, left: -10,
                          width: 18, height: 18, borderRadius: '50%',
                          background: '#ff6a3d', color: '#fff',
                          cursor: 'pointer', fontSize: 16,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          zIndex: 20,
                        }}
                      >−</div>
                      <div
                        onMouseDown={e => { e.stopPropagation(); scalePhoto(1.1); }}
                        style={{
                          position: 'absolute', bottom: -10, right: -10,
                          width: 18, height: 18, borderRadius: '50%',
                          background: '#ff6a3d', color: '#fff',
                          cursor: 'pointer', fontSize: 16,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          zIndex: 20,
                        }}
                      >+</div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Text layers — draggable */}
            {userTexts.map(txt => {
              const isSelected = selectedTextId === txt.id;
              return (
                <div
                  key={txt.id}
                  onMouseDown={e => onTextMouseDown(e, txt.id)}
                  onClick={e => { e.stopPropagation(); setSelectedTextId(txt.id); setSelectedPhotoId(null); }}
                  style={{
                    position: 'absolute',
                    left: txt.x,
                    top: txt.y,
                    cursor: 'move',
                    fontFamily: txt.font,
                    fontSize: txt.size,
                    color: txt.color,
                    fontWeight: txt.bold ? 'bold' : 'normal',
                    fontStyle: txt.italic ? 'italic' : 'normal',
                    userSelect: 'none',
                    padding: '2px 4px',
                    border: isSelected ? '1.5px dashed #ff6a3d' : '1.5px dashed transparent',
                    borderRadius: '3px',
                    zIndex: isSelected ? 15 : 8,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {txt.text}
                  {isSelected && (
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); deleteText(txt.id); }}
                      style={{
                        position: 'absolute', top: -10, right: -10,
                        width: 20, height: 20, borderRadius: '50%',
                        background: '#ef4444', color: '#fff',
                        border: 'none', cursor: 'pointer',
                        fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 20,
                      }}
                    >×</button>
                  )}
                </div>
              );
            })}

            {/* Empty state overlay */}
            {userPhotos.length === 0 && userTexts.length === 0 && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                style={{ background: 'rgba(0,0,0,0.03)' }}
              >
                <span className="text-4xl mb-2">📸</span>
                <p className="text-gray-500 text-sm font-medium">Upload your photo</p>
                <p className="text-gray-400 text-xs mt-1">It will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Product Images */}
        {productImages.length > 0 && (
          <div className="w-52 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Product Images</h3>
              <div className="space-y-3">
                {productImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImageIndex(i)}
                    className={`w-full rounded-xl overflow-hidden border-2 transition ${activeImageIndex === i ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 hover:border-orange-300'}`}
                  >
                    <div className="aspect-square bg-gray-50">
                      <img
                        src={img}
                        alt={`Design ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className={`py-1.5 text-xs font-medium text-center ${activeImageIndex === i ? 'bg-orange-500 text-white' : 'text-gray-600'}`}>
                      Design {i + 1}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Saved Designs Panel ─────────────────────────────────────────── */}
      {showSavedPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowSavedPanel(false)}
        >
          <div
            className="bg-white rounded-2xl w-full overflow-hidden"
            style={{ maxWidth: '680px', maxHeight: '80vh', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">My Saved Designs</h2>
                <p className="text-xs text-gray-400 mt-0.5">{savedDesigns.length} design{savedDesigns.length !== 1 ? 's' : ''} saved</p>
              </div>
              <button
                onClick={() => setShowSavedPanel(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Designs Grid */}
            <div className="overflow-y-auto p-5" style={{ maxHeight: 'calc(80vh - 80px)' }}>
              {savedDesigns.length === 0 ? (
                <div className="text-center py-16">
                  <span className="text-5xl mb-4 block">🎨</span>
                  <p className="text-gray-500 font-medium mb-1">No saved designs yet</p>
                  <p className="text-gray-400 text-sm">Click "Save" in the editor to save your design</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {savedDesigns.map(design => (
                    <div
                      key={design.id}
                      className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200 hover:border-orange-300 transition group"
                    >
                      <div className="aspect-video bg-gray-100 overflow-hidden">
                        {design.thumbnail ? (
                          <img src={design.thumbnail} alt={design.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">🖼</div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="font-semibold text-gray-800 text-xs truncate mb-0.5">{design.productName}</p>
                        <p className="text-gray-400 text-xs truncate mb-3">
                          {new Date(design.savedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadDesign(design)}
                            className="flex-1 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition"
                          >Load</button>
                          <button
                            onClick={() => deleteDesign(design.id)}
                            className="w-8 h-7 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition text-sm"
                          >🗑</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Ready for Review Modal ───────────────────────────────────────── */}
      {showReviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => { setShowReviewModal(false); setReviewSubmitted(false); }}
        >
          <div
            className="bg-white rounded-2xl w-full overflow-hidden"
            style={{ maxWidth: '480px', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            {!reviewSubmitted ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg">Ready for Review</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Submit your design for team review</p>
                  </div>
                  <button onClick={() => setShowReviewModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition">
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Body */}
                <div className="p-6">
                  {/* Design preview */}
                  <div className="rounded-xl overflow-hidden border border-gray-200 mb-5" style={{ height: '180px', backgroundColor: '#f9fafb' }}>
                    {productImages[activeImageIndex] ? (
                      <img src={productImages[activeImageIndex]} alt="Design preview" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🖼</div>
                    )}
                  </div>

                  {/* Product info */}
                  <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ backgroundColor: '#f3f4f6' }}>
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{product?.name || 'Design'}</p>
                      <p className="text-xs text-gray-400">₹{displayPrice.toFixed(2)} · Qty: {quantity}</p>
                    </div>
                  </div>

                  {/* Note */}
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Add a note (optional)</label>
                  <textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    placeholder="Any special instructions or notes for the review team..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none resize-none mb-5"
                    style={{ border: '1.5px solid #e5e7eb', color: '#374151' }}
                  />

                  {/* Info box */}
                  <div className="flex items-start gap-2 p-3 rounded-xl mb-5" style={{ backgroundColor: '#eff6ff', border: '1px solid #dbeafe' }}>
                    <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Our team will review your design within 24 hours. You'll be notified once it's approved and ready to print.
                    </p>
                  </div>

                  {/* Submit */}
                  <button
                    onClick={submitForReview}
                    disabled={reviewSubmitting}
                    className="w-full py-3 rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#111111', color: '#ffffff' }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {reviewSubmitting ? 'Submitting...' : 'Submit for Review'}
                  </button>
                </div>
              </>
            ) : (
              /* Success State */
              <div className="p-10 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ backgroundColor: '#16a34a', boxShadow: '0 0 0 12px #dcfce7' }}>
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="font-bold text-gray-900 text-xl mb-2">Submitted for Review!</h2>
                <p className="text-sm text-gray-500 mb-1">Your design has been submitted successfully.</p>
                <p className="text-sm text-gray-400 mb-6">Our team will review it within 24 hours.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowReviewModal(false); setReviewSubmitted(false); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
                  >
                    Continue Editing
                  </button>
                  <button
                    onClick={() => navigate('/cart')}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: '#111111' }}
                  >
                    Go to Cart
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleFrameEditorPage;
