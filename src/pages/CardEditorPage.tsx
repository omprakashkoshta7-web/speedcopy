import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Save, Palette, Type, Layout, Layers, ShoppingCart, Upload, X } from 'lucide-react';
import Navbar from '../components/Navbar';
import html2canvas from 'html2canvas';
import { useAuth } from '../context/AuthContext';

const CardEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  const [selectedColor, setSelectedColor] = useState('#111111');
  const [selectedLayout, setSelectedLayout] = useState('horizontal');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState<'left' | 'right' | 'background' | 'logo'>('logo');
  const [cardText, setCardText] = useState({
    name: 'John Doe',
    title: 'CEO & Founder',
    phone: '+91 98765 43210',
    email: 'john@company.com',
    website: 'www.company.com',
    address: '123 Business Street, Mumbai',
  });

  const templates = [
    { 
      id: 'modern', 
      name: 'Modern', 
      bgColor: '#3b82f6', 
      textColor: '#ffffff',
      preview: 'Modern professional design with blue gradient'
    },
    { 
      id: 'classic', 
      name: 'Classic', 
      bgColor: '#1f2937', 
      textColor: '#ffffff',
      preview: 'Traditional dark elegant design'
    },
    { 
      id: 'minimal', 
      name: 'Minimal', 
      bgColor: '#ffffff', 
      textColor: '#111111',
      preview: 'Clean white minimalist design'
    },
    { 
      id: 'bold', 
      name: 'Bold', 
      bgColor: '#dc2626', 
      textColor: '#ffffff',
      preview: 'Eye-catching red bold design'
    },
    { 
      id: 'elegant', 
      name: 'Elegant', 
      bgColor: '#8b5cf6', 
      textColor: '#ffffff',
      preview: 'Sophisticated purple design'
    },
    { 
      id: 'gradient', 
      name: 'Gradient', 
      bgColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
      textColor: '#ffffff',
      preview: 'Vibrant gradient design'
    },
  ];

  const colorSchemes = [
    { id: 'black', color: '#111111', name: 'Black' },
    { id: 'blue', color: '#3b82f6', name: 'Blue' },
    { id: 'red', color: '#dc2626', name: 'Red' },
    { id: 'green', color: '#16a34a', name: 'Green' },
    { id: 'purple', color: '#8b5cf6', name: 'Purple' },
    { id: 'orange', color: '#ea580c', name: 'Orange' },
    { id: 'pink', color: '#ec4899', name: 'Pink' },
    { id: 'teal', color: '#14b8a6', name: 'Teal' },
  ];

  const layouts = [
    { id: 'horizontal', name: 'Horizontal', desc: 'Classic left-to-right layout' },
    { id: 'vertical', name: 'Vertical', desc: 'Top-to-bottom layout' },
    { id: 'centered', name: 'Centered', desc: 'Center-aligned layout' },
    { id: 'split', name: 'Split', desc: 'Two-column layout' },
  ];

  const currentTemplate = templates.find(t => t.id === selectedTemplate) || templates[0];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPG, PNG, SVG, etc.)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
  };

  const handleSave = () => {
    const designData = {
      template: selectedTemplate,
      color: selectedColor,
      layout: selectedLayout,
      text: cardText,
      uploadedImage: uploadedImage || null,
      imagePosition,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('businessCardDesign', JSON.stringify(designData));
    alert('✅ Card design saved successfully!');
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      // Convert card to canvas
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2, // Higher quality
        logging: false,
      });
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (!blob) return;
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `business-card-${cardText.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert('✅ Card downloaded successfully!');
      }, 'image/png');
    } catch (error) {
      console.error('Download failed:', error);
      alert('❌ Failed to download card. Please try again.');
    }
  };

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      alert('Please login to continue');
      navigate('/');
      return;
    }

    const designData = {
      template: selectedTemplate,
      color: selectedColor,
      layout: selectedLayout,
      text: cardText,
      uploadedImage: uploadedImage || null,
      imagePosition,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('businessCardDesign', JSON.stringify(designData));
    navigate('/business-card-checkout', { state: { cardDesign: designData } });
  };

  return (
    <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
            >
              <ArrowLeft size={18} />
              Back
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="font-bold text-gray-900 text-xl">Card Editor</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-full font-semibold text-sm hover:bg-gray-50 transition"
            >
              <Download size={16} />
              Download
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-full font-semibold text-sm hover:bg-gray-50 transition"
            >
              <Save size={16} />
              Save Design
            </button>
            <button
              onClick={handleAddToCart}
              className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-full font-semibold text-sm hover:bg-gray-800 transition"
            >
              <ShoppingCart size={16} />
              Add to Cart
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Tools */}
          <div className="col-span-3 space-y-4">
            {/* Upload Image */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Upload size={18} className="text-gray-700" />
                <h3 className="font-bold text-gray-900">Upload Image</h3>
              </div>

              {uploadedImage ? (
                <div className="space-y-3">
                  {/* Preview */}
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50" style={{ height: '100px' }}>
                    <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-contain p-2" />
                    <button
                      onClick={handleRemoveImage}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {/* Position selector */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">Image Position</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['logo', 'left', 'right', 'background'] as const).map(pos => (
                        <button
                          key={pos}
                          onClick={() => setImagePosition(pos)}
                          className="py-1.5 px-2 rounded-lg text-xs font-semibold capitalize transition"
                          style={{
                            backgroundColor: imagePosition === pos ? '#111111' : '#f3f4f6',
                            color: imagePosition === pos ? '#ffffff' : '#374151',
                          }}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 rounded-xl border border-dashed border-gray-300 text-xs font-semibold text-gray-500 hover:border-gray-400 hover:text-gray-700 transition"
                  >
                    Replace Image
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition"
                >
                  <Upload size={24} className="text-gray-400" />
                  <span className="text-sm font-semibold text-gray-600">Click to upload</span>
                  <span className="text-xs text-gray-400">PNG, JPG, SVG supported</span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
            {/* Templates */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Layers size={18} className="text-gray-700" />
                <h3 className="font-bold text-gray-900">Templates</h3>
              </div>
              <div className="space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`w-full p-3 rounded-xl border-2 transition text-left ${
                      selectedTemplate === template.id
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Mini Card Preview */}
                      <div
                        className="w-16 h-10 rounded-lg flex items-center justify-center text-xs font-bold relative overflow-hidden"
                        style={{ background: template.bgColor, color: template.textColor }}
                      >
                        <div className="absolute inset-0 flex flex-col justify-between p-1">
                          <div className="text-[6px] font-bold">{cardText.name.split(' ')[0]}</div>
                          <div className="text-[4px] opacity-70">{cardText.title.substring(0, 10)}</div>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                        <p className="text-xs text-gray-500">{template.preview}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Palette size={18} className="text-gray-700" />
                <h3 className="font-bold text-gray-900">Colors</h3>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {colorSchemes.map((scheme) => (
                  <button
                    key={scheme.id}
                    onClick={() => setSelectedColor(scheme.color)}
                    className={`w-full aspect-square rounded-lg border-2 transition ${
                      selectedColor === scheme.color
                        ? 'border-gray-900 scale-105'
                        : 'border-gray-200 hover:scale-105'
                    }`}
                    style={{ backgroundColor: scheme.color }}
                    title={scheme.name}
                  />
                ))}
              </div>
            </div>

            {/* Layouts */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Layout size={18} className="text-gray-700" />
                <h3 className="font-bold text-gray-900">Layout</h3>
              </div>
              <div className="space-y-2">
                {layouts.map((layout) => (
                  <button
                    key={layout.id}
                    onClick={() => setSelectedLayout(layout.id)}
                    className={`w-full p-3 rounded-xl border-2 transition text-left ${
                      selectedLayout === layout.id
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900 mb-1">{layout.name}</p>
                    <p className="text-xs text-gray-500">{layout.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Center - Canvas */}
          <div className="col-span-6">
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <div className="flex items-center justify-center" style={{ minHeight: '600px' }}>
                {/* Business Card Preview */}
                <div
                  ref={cardRef}
                  className="rounded-2xl shadow-2xl p-8 relative overflow-hidden"
                  style={{
                    width: '500px',
                    height: '300px',
                    background: currentTemplate.bgColor,
                    color: currentTemplate.textColor,
                  }}
                >
                  {/* Background image overlay */}
                  {uploadedImage && imagePosition === 'background' && (
                    <div
                      className="absolute inset-0 z-0"
                      style={{
                        backgroundImage: `url(${uploadedImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        opacity: 0.25,
                      }}
                    />
                  )}

                  {/* Layout: Horizontal */}
                  {selectedLayout === 'horizontal' && (
                    <div className="h-full flex flex-col justify-between relative z-10">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="font-bold text-3xl mb-2">{cardText.name}</h2>
                          <p className="text-lg opacity-80">{cardText.title}</p>
                        </div>
                        {uploadedImage && imagePosition === 'logo' && (
                          <img src={uploadedImage} alt="Logo" className="w-14 h-14 object-contain rounded-lg flex-shrink-0" />
                        )}
                        {uploadedImage && imagePosition === 'right' && (
                          <img src={uploadedImage} alt="Card image" className="w-24 h-24 object-cover rounded-xl flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-end justify-between">
                        <div className="space-y-1 text-sm opacity-90">
                          <p>{cardText.phone}</p>
                          <p>{cardText.email}</p>
                          <p>{cardText.website}</p>
                        </div>
                        {uploadedImage && imagePosition === 'left' && (
                          <img src={uploadedImage} alt="Card image" className="w-20 h-20 object-cover rounded-xl flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Layout: Vertical */}
                  {selectedLayout === 'vertical' && (
                    <div className="h-full flex flex-col items-center justify-center text-center relative z-10">
                      {uploadedImage && (imagePosition === 'logo' || imagePosition === 'left') && (
                        <img src={uploadedImage} alt="Logo" className="w-16 h-16 object-contain rounded-xl mb-3" />
                      )}
                      <h2 className="font-bold text-3xl mb-2">{cardText.name}</h2>
                      <p className="text-lg opacity-80 mb-4">{cardText.title}</p>
                      <div className="space-y-1 text-sm opacity-90">
                        <p>{cardText.phone}</p>
                        <p>{cardText.email}</p>
                        <p>{cardText.website}</p>
                      </div>
                    </div>
                  )}

                  {/* Layout: Centered */}
                  {selectedLayout === 'centered' && (
                    <div className="h-full flex items-center justify-center relative z-10">
                      <div className="text-center">
                        {uploadedImage && imagePosition === 'logo' && (
                          <img src={uploadedImage} alt="Logo" className="w-14 h-14 object-contain rounded-xl mx-auto mb-3" />
                        )}
                        <h2 className="font-bold text-4xl mb-3">{cardText.name}</h2>
                        <p className="text-xl opacity-80 mb-6">{cardText.title}</p>
                        <div className="space-y-2 text-sm opacity-90">
                          <p>{cardText.phone}</p>
                          <p>{cardText.email}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Layout: Split */}
                  {selectedLayout === 'split' && (
                    <div className="h-full grid grid-cols-2 gap-8 relative z-10">
                      <div className="flex flex-col justify-center">
                        {uploadedImage && imagePosition === 'logo' && (
                          <img src={uploadedImage} alt="Logo" className="w-12 h-12 object-contain rounded-lg mb-3" />
                        )}
                        <h2 className="font-bold text-2xl mb-2">{cardText.name}</h2>
                        <p className="text-base opacity-80">{cardText.title}</p>
                      </div>
                      <div className="flex flex-col justify-center">
                        {uploadedImage && (imagePosition === 'right' || imagePosition === 'left') ? (
                          <img src={uploadedImage} alt="Card image" className="w-full h-28 object-cover rounded-xl mb-2" />
                        ) : (
                          <div className="space-y-1 text-sm opacity-90">
                            <p>{cardText.phone}</p>
                            <p>{cardText.email}</p>
                            <p>{cardText.website}</p>
                            <p className="text-xs mt-2">{cardText.address}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Decorative Element */}
                  <div
                    className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full opacity-10 z-0"
                    style={{ backgroundColor: currentTemplate.textColor }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Text Editor */}
          <div className="col-span-3">
            <div className="bg-white rounded-2xl p-5 border border-gray-200 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <Type size={18} className="text-gray-700" />
                <h3 className="font-bold text-gray-900">Edit Text</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={cardText.name}
                    onChange={(e) => setCardText({ ...cardText, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-gray-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={cardText.title}
                    onChange={(e) => setCardText({ ...cardText, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-gray-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={cardText.phone}
                    onChange={(e) => setCardText({ ...cardText, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-gray-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={cardText.email}
                    onChange={(e) => setCardText({ ...cardText, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-gray-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Website</label>
                  <input
                    type="url"
                    value={cardText.website}
                    onChange={(e) => setCardText({ ...cardText, website: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-gray-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Address</label>
                  <textarea
                    value={cardText.address}
                    onChange={(e) => setCardText({ ...cardText, address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-gray-900 transition resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardEditorPage;
