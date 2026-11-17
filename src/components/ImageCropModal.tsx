/**
 * HackhIt — 1:1 Aspect Ratio Profile Photo Cropper Modal
 *
 * Provides students with an interactive, touch-friendly 1:1 square image cropper:
 * 1. Panning & dragging across touchscreens and desktop mice
 * 2. Smooth zoom slider (1x to 3x) and step buttons
 * 3. 90-degree clockwise rotation
 * 4. Circular & square guide overlay with live preview
 * 5. High-fidelity HTML5 Canvas rendering at 512x512 resolution (exported as JPEG File)
 */

import { useState, useRef, useEffect, useCallback, useMemo, type MouseEvent, type TouchEvent } from 'react'
import {
  Crop,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Check,
  X,
  Move,
  Sparkles,
} from 'lucide-react'

export interface ImageCropModalProps {
  isOpen: boolean
  imageSrc: string | null
  onCropComplete: (croppedFile: File, previewUrl: string) => void
  onCancel: () => void
}

const CROP_BOX_SIZE = 280 // Visual crop box dimensions in pixels

export function ImageCropModal({
  isOpen,
  imageSrc,
  onCropComplete,
  onCancel,
}: ImageCropModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1.0)
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isProcessing, setIsProcessing] = useState(false)

  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Reset state when a new image is loaded
  useEffect(() => {
    if (imageSrc) {
      setImageLoaded(false)
      setZoom(1.0)
      setRotation(0)
      setPan({ x: 0, y: 0 })
      setIsProcessing(false)

      const img = new Image()
      img.src = imageSrc
      img.onload = () => {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
        setImageLoaded(true)
      }
    }
  }, [imageSrc])

  // Compute base scaling so image fully covers the CROP_BOX_SIZE square initially
  const baseScale = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return 1
    const isRotated = rotation % 180 !== 0
    const effW = isRotated ? naturalSize.height : naturalSize.width
    const effH = isRotated ? naturalSize.width : naturalSize.height
    return Math.max(CROP_BOX_SIZE / effW, CROP_BOX_SIZE / effH)
  }, [naturalSize, rotation])

  const currentScale = baseScale * zoom

  // Clamp pan so image doesn't get dragged too far out of frame
  const clampPan = useCallback(
    (newX: number, newY: number, currentZ: number, rot: number) => {
      if (!naturalSize.width || !naturalSize.height) return { x: newX, y: newY }
      const isRot = rot % 180 !== 0
      const effW = (isRot ? naturalSize.height : naturalSize.width) * baseScale * currentZ
      const effH = (isRot ? naturalSize.width : naturalSize.height) * baseScale * currentZ

      const maxPanX = Math.max(0, (effW - CROP_BOX_SIZE) / 2 + 40)
      const maxPanY = Math.max(0, (effH - CROP_BOX_SIZE) / 2 + 40)

      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, newY)),
      }
    },
    [naturalSize, baseScale]
  )

  // Mouse drag handlers
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const rawX = e.clientX - dragStart.x
    const rawY = e.clientY - dragStart.y
    setPan(clampPan(rawX, rawY, zoom, rotation))
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Touch drag handlers for mobile devices
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      const touch = e.touches[0]
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y })
    }
  }

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!isDragging || e.touches.length !== 1) return
    const touch = e.touches[0]
    const rawX = touch.clientX - dragStart.x
    const rawY = touch.clientY - dragStart.y
    setPan(clampPan(rawX, rawY, zoom, rotation))
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Quick zoom controls
  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(1.0, Math.min(3.0, newZoom))
    setZoom(clamped)
    setPan((prev) => clampPan(prev.x, prev.y, clamped, rotation))
  }

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    const newRot = (rotation + 90) % 360
    setRotation(newRot)
    setPan({ x: 0, y: 0 }) // center after rotation
  }

  // Reset crop
  const handleReset = () => {
    setZoom(1.0)
    setRotation(0)
    setPan({ x: 0, y: 0 })
  }

  // Generate 1:1 Canvas and output as high-quality File
  const handleConfirmCrop = async () => {
    if (!imageSrc || !naturalSize.width || !naturalSize.height || isProcessing) return
    setIsProcessing(true)

    try {
      const OUTPUT_SIZE = 512 // 512x512 resolution for crisp display
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('Canvas 2D context not available')
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Clean background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      // Ratio between canvas resolution (512) and visual preview box (280)
      const canvasScale = OUTPUT_SIZE / CROP_BOX_SIZE

      // Translate context to center of crop canvas + pan offset
      ctx.translate(
        OUTPUT_SIZE / 2 + pan.x * canvasScale,
        OUTPUT_SIZE / 2 + pan.y * canvasScale
      )

      // Apply rotation
      ctx.rotate((rotation * Math.PI) / 180)

      // Apply scale
      ctx.scale(canvasScale * currentScale, canvasScale * currentScale)

      // Draw the image centered
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = imageSrc

      await new Promise<void>((resolve, reject) => {
        if (img.complete) resolve()
        else {
          img.onload = () => resolve()
          img.onerror = reject
        }
      })

      ctx.drawImage(img, -naturalSize.width / 2, -naturalSize.height / 2)

      // Export as JPEG blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setIsProcessing(false)
            return
          }
          const fileName = `avatar_${Date.now()}.jpg`
          const croppedFile = new File([blob], fileName, { type: 'image/jpeg' })
          const previewUrl = URL.createObjectURL(blob)
          onCropComplete(croppedFile, previewUrl)
          setIsProcessing(false)
        },
        'image/jpeg',
        0.92
      )
    } catch (err) {
      console.error('Failed to crop avatar image:', err)
      setIsProcessing(false)
    }
  }

  if (!isOpen || !imageSrc) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cropper-modal-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#050505]/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-md rounded-[28px] border-[2.5px] border-[#050505] bg-[#fffef8] p-5 sm:p-6 shadow-[6px_6px_0_#050505] text-[#050505] space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#050505]/15 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-[#050505] bg-[#F5F04A] text-[#050505] shadow-[1.5px_1.5px_0_#050505]">
              <Crop size={16} />
            </span>
            <div>
              <h3 id="cropper-modal-title" className="font-black text-sm uppercase tracking-tight text-[#050505]">
                Adjust 1:1 Profile Photo
              </h3>
              <p className="text-[11px] text-[#050505]/70">
                Drag to center your face & zoom to fit
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="grid h-8 w-8 place-items-center rounded-xl border border-[#050505] bg-white text-[#050505] hover:bg-neutral-100 cursor-pointer shadow-[1px_1px_0_#050505]"
            aria-label="Close photo cropper"
          >
            <X size={15} />
          </button>
        </div>

        {/* Interactive Crop Viewport */}
        <div className="flex flex-col items-center">
          <div
            ref={containerRef}
            style={{ width: `${CROP_BOX_SIZE}px`, height: `${CROP_BOX_SIZE}px` }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`relative overflow-hidden rounded-2xl border-[2.5px] border-[#050505] bg-[#1a1a1a] shadow-[4px_4px_0_#050505] select-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* The Image being transformed */}
            {imageLoaded && (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop preview target"
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${currentScale})`,
                  transformOrigin: 'center center',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  pointerEvents: 'none',
                  transition: isDragging ? 'none' : 'transform 0.05s ease-out',
                }}
              />
            )}

            {/* Circular Guide Mask Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Dashed circle avatar boundary */}
              <div
                style={{ width: `${CROP_BOX_SIZE - 20}px`, height: `${CROP_BOX_SIZE - 20}px` }}
                className="rounded-full border-2 border-dashed border-[#F5F04A]/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              />
            </div>

            {/* Drag helper watermark */}
            <div className="absolute bottom-2 left-2 pointer-events-none rounded-full bg-[#050505]/75 px-2 py-0.5 text-[9px] font-bold text-[#E9E7D8] flex items-center gap-1">
              <Move size={10} /> Drag to position
            </div>
          </div>
        </div>

        {/* Controls Toolbar: Zoom Slider, Rotate, Reset */}
        <div className="space-y-3 bg-[#E9E7D8]/60 rounded-2xl border border-[#050505]/15 p-3.5 text-xs">
          {/* Zoom Slider */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleZoomChange(zoom - 0.2)}
              disabled={zoom <= 1.0}
              className="grid h-7 w-7 place-items-center rounded-lg border border-[#050505] bg-white text-[#050505] shadow-[1px_1px_0_#050505] disabled:opacity-40 cursor-pointer"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut size={13} />
            </button>

            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              aria-label="Zoom photo"
              className="flex-1 accent-[#050505] cursor-pointer h-1.5 bg-[#050505]/20 rounded-lg"
            />

            <button
              type="button"
              onClick={() => handleZoomChange(zoom + 0.2)}
              disabled={zoom >= 3.0}
              className="grid h-7 w-7 place-items-center rounded-lg border border-[#050505] bg-white text-[#050505] shadow-[1px_1px_0_#050505] disabled:opacity-40 cursor-pointer"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn size={13} />
            </button>

            <span className="font-mono text-[10px] font-bold text-[#050505] min-w-[34px] text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Quick Buttons: Rotate & Reset */}
          <div className="flex items-center justify-between border-t border-[#050505]/10 pt-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRotate}
                className="inline-flex min-h-[30px] cursor-pointer items-center gap-1.5 rounded-lg border border-[#050505] bg-white px-2.5 text-[11px] font-bold text-[#050505] shadow-[1px_1px_0_#050505] hover:bg-[#F5F04A] transition-colors"
              >
                <RotateCw size={12} />
                <span>Rotate 90°</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded-lg border border-[#050505]/40 bg-white px-2 text-[11px] font-bold text-[#050505] hover:bg-neutral-100"
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-[#050505]/60">
              <Sparkles size={11} className="text-[#050505]" />
              <span>1:1 Square Ratio</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-full border border-[#050505] bg-white px-5 text-xs font-bold uppercase tracking-wider text-[#050505] shadow-[1.5px_1.5px_0_#050505] hover:bg-neutral-100"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmCrop}
            disabled={isProcessing || !imageLoaded}
            className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-full border-[1.5px] border-[#050505] bg-[#F5F04A] px-6 text-xs font-black uppercase tracking-wider text-[#050505] shadow-[2.5px_2.5px_0_#050505] hover:-translate-y-0.5 transition-transform disabled:opacity-50"
          >
            <Check size={14} />
            <span>{isProcessing ? 'Cropping...' : 'Crop & Use Photo'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
