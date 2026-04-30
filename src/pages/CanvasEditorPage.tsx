import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fabric } from 'fabric';
import { ArrowLeft, Upload, Trash2, Plus, Minus } from 'lucide-react';
import productService from '../services/product.service';
import orderService from '../services/order.service';
import { useAuth } from '../context/AuthContext';

type ProductRecord = {
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
};

const CanvasEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  const productId = searchParams.get('productId');
  const displayPrice = product?.sale_price || product?.discountedPrice || product?.basePrice || 0;

  // Initialize canvas
  useEffect(() => {
    const initCanvas = async () => {
      try {
        if (!productId) {
          navigate('/gifting');
          return;
        }

        setLoading(true);
        setError('');

        // Fetch product
        const response = await productService.getGiftingProductById(productId);
        const productData = (response?.data || response) as ProductRecord;
        setProduct(productData);

        // Initialize fabric canvas
        if (canvasRef.current) {
          const fabricCanvas = new fabric.Canvas(canvasRef.current, {
            width: 800,
            height: 1000,
            backgroundColor: '#ffffff',
            preserveObjectStacking: true,
          });

          fabricCanvas.selectionColor = 'rgba(255, 106, 61, 0.12)';
          fabricCanvas.selectionBorderColor = '#ff6a3d';
          fabricCanvas.selectionLineWidth = 1.2;

          // Load frame image
          if (productData?.thumbnail || productData?.image) {
            const frameUrl = productData.thumbnail || productData.image;
            fabric.Image.fromURL(
              frameUrl,
              (img: any) => {
                if (img) {
                  const scale = Math.min(
                    fabricCanvas.width! / img.width,
                    fabricCanvas.height! / img.height
                  );

                  img.set({
                    left: 0,
                    top: 0,
                    originX: 'left',
                    originY: 'top',
                    scaleX: scale,
                    scaleY: scale,
                    selectable: false,
                    evented: false,
                  });

                  fabricCanvas.add(img);
                  fabricCanvas.sendToBack(img);
                  fabricCanvas.renderAll();
                  console.log('✅ Frame loaded successfully');
                }
              },
              { crossOrigin: 'anonymous' }
            );
          }

          setCanvas(fabricCanvas);
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Error initializing canvas:', err);
        setError(err?.message || 'Failed to load editor');
        setLoading(false);
      }
    };

    initCanvas();

    return () => {
      canvas?.dispose();
    };
  }, [productId, navigate]);

  // Add image to canvas
  const addImageToCanvas = (src: string) => {
    if (!canvas) return;

    const options: any = src.startsWith('data:') ? {} : { crossOrigin: 'anonymous' };

    fabric.Image.fromURL(
      src,
      (img: any) => {
        if (!img) {
          alert('Failed to load image');
          return;
        }

        const centerX = canvas.width! / 2;
        const centerY = canvas.height! / 2;

        img.set({
          left: centerX,
          top: centerY,
          originX: 'center',
          originY: 'center',
          cornerColor: '#ff6a3d',
          borderColor: '#ff6a3d',
        });

        img.scaleToWidth(300);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      },
      options
    );
  };

  // Handle file upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setUploadedImages((prev) => [...prev, dataUrl]);
        addImageToCanvas(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  // Delete selected object
  const deleteSelected = () => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.remove(activeObject);
      canvas.renderAll();
    }
  };

  // Add to cart
  const addToCart = async () => {
    if (!isAuthenticated) {
      alert('Please login to add items to cart');
      navigate('/');
      return;
    }

    if (!canvas || !product) {
      setError('Missing canvas or product data');
      return;
    }

    try {
      const designPreview = canvas.toDataURL({
        format: 'jpeg',
        quality: 0.8,
        multiplier: 1,
      });

      await orderService.addToCart({
        productId: product._id || product.id || productId,
        productName: product.name || 'Canvas Design',
        flowType: 'gifting',
        quantity,
        unitPrice: displayPrice,
        totalPrice: displayPrice * quantity,
        designId: `canvas-${productId}-${Date.now()}`,
        thumbnail: designPreview,
        designPreview,
        designJson: '',
        designName: `${product.name} - Canvas Design`,
        options: {
          source: 'canvas-editor',
          productPrice: displayPrice,
          productName: product.name || '',
        },
      });

      alert('Added to cart successfully!');
      navigate('/cart');
    } catch (err: any) {
      console.error('Error adding to cart:', err);
      setError(err?.message || 'Failed to add to cart');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6a3d] mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold">Loading canvas editor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center max-w-md">
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-[#1e2a43] text-white px-6 py-2 rounded-full font-semibold hover:bg-[#151f33]"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header - Compact */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft size={18} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Canvas Editor</h1>
              <p className="text-xs text-slate-500">{product?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 py-1.5">
              <button
                onClick={() => setZoom((prev) => Math.max(50, prev - 10))}
                className="p-1 hover:bg-white rounded transition"
              >
                <Minus size={14} />
              </button>
              <span className="text-xs font-semibold w-10 text-center">{zoom}%</span>
              <button
                onClick={() => setZoom((prev) => Math.min(150, prev + 10))}
                className="p-1 hover:bg-white rounded transition"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Download button removed - users must purchase to download */}

            <button
              onClick={addToCart}
              className="flex items-center gap-2 px-4 py-2 bg-[#ff6a3d] text-white rounded-lg hover:bg-[#f35c2c] transition font-semibold text-sm"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left Panel - Tools - Compact */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-3 shadow-sm space-y-2">
              <h2 className="text-sm font-bold text-slate-900">Tools</h2>

              {/* Upload */}
              <div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#ff6a3d] text-white rounded-lg hover:bg-[#f35c2c] transition font-semibold text-xs"
                >
                  <Upload size={12} />
                  Upload Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
              </div>

              {/* Delete */}
              <button
                onClick={deleteSelected}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-semibold text-xs"
              >
                <Trash2 size={12} />
                Delete Selected
              </button>

              {/* Quantity */}
              <div className="border-t pt-2">
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Quantity</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                    className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition text-xs"
                  >
                    −
                  </button>
                  <span className="flex-1 text-center font-semibold text-xs">{quantity}</span>
                  <button
                    onClick={() => setQuantity((prev) => prev + 1)}
                    className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition text-xs"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Price */}
              <div className="border-t pt-2">
                <p className="text-xs text-slate-600 mb-0.5">Price per unit</p>
                <p className="text-lg font-bold text-[#ff6a3d]">₹{displayPrice.toFixed(2)}</p>
                <p className="text-xs text-slate-600 mt-0.5">Total: ₹{(displayPrice * quantity).toFixed(2)}</p>
              </div>

              {/* Uploaded Images */}
              {uploadedImages.length > 0 && (
                <div className="border-t pt-2">
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">Uploaded ({uploadedImages.length})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {uploadedImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => addImageToCanvas(img)}
                        className="rounded-lg overflow-hidden border-2 border-gray-200 hover:border-[#ff6a3d] transition"
                      >
                        <img src={img} alt={`upload-${idx}`} className="w-full h-10 object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Canvas Area - Compact */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-center bg-gray-50 rounded-xl p-3 overflow-auto" style={{ maxHeight: '500px' }}>
                <div
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <canvas ref={canvasRef} className="border-2 border-gray-300 rounded-lg" />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3 text-center">
                Click on photos in the left panel to add them to the canvas. Drag to move, resize handles to scale.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanvasEditorPage;
