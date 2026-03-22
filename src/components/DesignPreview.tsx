import { useState, useRef } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Copy, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { getApiBaseUrl, getAuthHeaders } from '@/lib/apiBase'

type Finding = {
  id: string
  category: string
  severity: string
  title: string
  [key: string]: unknown
}

type Step = {
  label: string
  options: { key: string; title: string; description: string }[]
}

const STEPS: Step[] = [
  {
    label: 'Style direction',
    options: [
      { key: 'minimal', title: 'Minimal & Clean', description: 'Reduce visual noise, increase whitespace, let content breathe' },
      { key: 'bold', title: 'Bold & Impactful', description: 'Stronger contrast, prominent CTA, high-energy visual hierarchy' },
    ],
  },
  {
    label: 'Color approach',
    options: [
      { key: 'contrast', title: 'Fix contrast only', description: 'Keep existing palette, enforce WCAG AA across all elements' },
      { key: 'refresh', title: 'Refresh the palette', description: 'Suggest a modern, accessible color scheme that fits the brand direction' },
    ],
  },
  {
    label: 'Priority focus',
    options: [
      { key: 'accessibility', title: 'Accessibility first', description: 'Contrast ratios, legibility, touch targets, WCAG compliance' },
      { key: 'layout', title: 'Layout & hierarchy', description: 'Spacing rhythm, visual flow, heading scale, scan path' },
    ],
  },
]

type Choices = { step1: string; step2: string; step3: string }

type PreviewResult = {
  description: string
  fix_prompt: string
  preview_image_url: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  scanId: string
  findings: Finding[]
  beforeImageUrl?: string | null
}

export default function DesignPreview({ open, onClose, scanId, beforeImageUrl }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 'loading' | 'result'>(1)
  const [choices, setChoices] = useState<Partial<Choices>>({})
  const [result, setResult] = useState<PreviewResult | null>(null)
  const generating = useRef(false)

  const currentStep = typeof step === 'number' ? STEPS[step - 1] : null
  const currentKey = step === 1 ? 'step1' : step === 2 ? 'step2' : 'step3'
  const currentChoice = typeof step === 'number' ? choices[currentKey as keyof Choices] : undefined

  const select = (key: string) => {
    setChoices(prev => ({ ...prev, [currentKey]: key }))
  }

  const next = async () => {
    if (step === 1) { setStep(2); return }
    if (step === 2) { setStep(3); return }
    if (step === 3) {
      if (generating.current) return
      generating.current = true
      setStep('loading')
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(`${getApiBaseUrl()}/v1/scans/${scanId}/preview`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ choices }),
        })
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const data: PreviewResult = await res.json()
        setResult(data)
        setStep('result')
      } catch (e) {
        toast.error('Preview generation failed. Please try again.')
        setStep(3)
      } finally {
        generating.current = false
      }
    }
  }

  const reset = () => {
    setStep(1)
    setChoices({})
    setResult(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Preview fixed design</SheetTitle>
        </SheetHeader>

        {/* Steps */}
        {typeof step === 'number' && currentStep && (
          <div className="space-y-6">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {[1, 2, 3].map(n => (
                <div key={n} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${n === step ? 'bg-primary text-primary-foreground' : n < step ? 'bg-primary/30 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {n}
                  </div>
                  {n < 3 && <div className={`h-px w-6 ${n < step ? 'bg-primary/30' : 'bg-muted'}`} />}
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Step {step} of 3</p>
              <h3 className="font-semibold">{currentStep.label}</h3>
            </div>

            <div className="space-y-3">
              {currentStep.options.map(opt => (
                <Card
                  key={opt.key}
                  className={`cursor-pointer transition-all ${currentChoice === opt.key ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
                  onClick={() => select(opt.key)}
                >
                  <CardContent className="p-4">
                    <p className="font-medium text-sm mb-1">{opt.title}</p>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              className="w-full"
              disabled={!currentChoice}
              onClick={next}
            >
              {step === 3 ? 'Generate preview' : 'Next'}
            </Button>
          </div>
        )}

        {/* Loading */}
        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground text-center">AIDQA is generating your corrected design…<br />This takes about 15–20 seconds.</p>
          </div>
        )}

        {/* Result */}
        {step === 'result' && result && (
          <div className="space-y-5">
            {/* Before / After visual */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 text-center">Before</p>
                <div className="rounded-lg overflow-hidden border bg-muted">
                  {beforeImageUrl ? (
                    <img src={beforeImageUrl} alt="Original design" className="w-full h-auto block" />
                  ) : (
                    <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">No image</div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 text-center">After (proposed)</p>
                <div className="rounded-lg overflow-hidden border bg-muted">
                  {result.preview_image_url ? (
                    <img src={result.preview_image_url} alt="Corrected design" className="w-full h-auto block" />
                  ) : (
                    <div className="h-32 flex flex-col items-center justify-center gap-1 px-2 text-center">
                      <p className="text-xs text-muted-foreground">Apply the fix prompt in your AI builder to see the result</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">What changes</p>
              <p className="text-sm">{result.description}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Fix prompt</p>
                <button
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  onClick={() => { navigator.clipboard.writeText(result.fix_prompt); toast.success('Prompt copied') }}
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <pre className="text-xs bg-muted p-3 rounded whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                {result.fix_prompt}
              </pre>
            </div>

            <Button variant="outline" className="w-full" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-2" /> Try different choices
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
