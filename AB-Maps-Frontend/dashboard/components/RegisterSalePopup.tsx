import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { User, Mail, Phone, Calendar, MapPin, CreditCard, PenLine, CheckCircle2, ArrowRight } from 'lucide-react';

interface RegisterSalePopupProps {
  open: boolean;
  onClose: () => void;
}

const initialForm = {
  first_name: '',
  last_name: '',
  email: '',
  sms_phone_number: '',
  date_of_birth: '',
  address_text: '',
  postnummer: '',
  posted: '',
  kontonummer: '',
  gavebeløp: '',
  beløpsgrense: '',
  skattefradrag_fødselsnummer: '',
  skip: false,
  signature: '',
};

type Step = 'selection' | 'avtalegiro' | 'vipps';

export default function RegisterSalePopup({ open, onClose }: RegisterSalePopupProps) {
  const [currentStep, setCurrentStep] = useState<Step>('selection');
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep('selection');
      setForm(initialForm);
      setError('');
      setFieldErrors({});
      setShowSuccess(false);
      setSubmitting(false);
      clearSignature();
    }
  }, [open]);

  // Helper function to get campaign from localStorage (handles both manager and employee dashboards)
  const getCampaignFromStorage = () => {
    // Try selectedCampaign first (manager dashboard)
    let campaignStr = localStorage.getItem("selectedCampaign");
    if (campaignStr) {
      try {
        const campaign = JSON.parse(campaignStr);
        if (campaign) return campaign;
      } catch (error) {
        console.error('Error parsing selectedCampaign:', error);
      }
    }
    
    // Try currentCampaign (employee dashboard)
    campaignStr = localStorage.getItem("currentCampaign");
    if (campaignStr) {
      try {
        const campaign = JSON.parse(campaignStr);
        if (campaign) return campaign;
      } catch (error) {
        console.error('Error parsing currentCampaign:', error);
      }
    }
    
    return null;
  };

  // Handle signature drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    setHasSignature(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        let clientX, clientY;
        if ('touches' in e) {
          e.preventDefault();
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
        }
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        let clientX, clientY;
        if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
        }
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };
  const stopDrawing = () => setIsDrawing(false);
  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
      }
    }
  };

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleStepSelection = (step: 'avtalegiro' | 'vipps') => {
    setCurrentStep(step);
    if (step === 'vipps') {
      handleVippsFlow();
    }
  };

  const handleVippsFlow = async () => {
    setSubmitting(true);
    setError('');
    
    try {
      // Get campaign from localStorage (handles both manager and employee dashboards)
      const selectedCampaign = getCampaignFromStorage();
      if (!selectedCampaign) {
        throw new Error('Ingen kampanje valgt.');
      }

      // Get access token
      let token = null;
      try {
        const tokens = localStorage.getItem('auth_tokens');
        if (tokens) {
          const parsed = JSON.parse(tokens);
          token = parsed.access;
        }
      } catch {}

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Get current user information
      const userDataStr = localStorage.getItem('user_data');
      let userData = null;
      if (userDataStr) {
        try {
          userData = JSON.parse(userDataStr);
        } catch {}
      }

      // Create metadata for Vipps flow
      const metadata = {
        tags: {
          source: "vipps_contact",
          timestamp: new Date().toISOString()
        },
        status: "ja",
        user_name: userData?.user_info?.name || userData?.username || "Unknown User",
        user_type: userData?.user_type || "employee",
        campaign_id: selectedCampaign.id,
        recorded_at: new Date().toISOString(),
        campaign_name: selectedCampaign.name
      };

      // Log Vipps Contact Activity with metadata
      const activityPayload: any = {
        activity_type: "vipps_contact",
        description: "Filled by Vipps redirect",
        campaign_id: selectedCampaign.id,
        metadata: metadata
      };

      const activityResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/activities/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(activityPayload),
      });

      if (!activityResponse.ok) {
        console.warn('Failed to log Vipps activity, but continuing with redirect');
      }

      // Close the popup first to ensure state is cleared
      onClose();
      
      // Redirect to VIPPS page
      window.open('https://folkehjelp.no/d2d-2', '_blank');
      
    } catch (err: any) {
      setError(err.message || 'Noe gikk galt med VIPPS prosessering.');
      setCurrentStep('selection');
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    if (!hasSignature) {
      setError('Signatur er påkrevd.');
      return;
    }
    const campaign = getCampaignFromStorage();
    if (!campaign) {
      setError('Ingen kampanje valgt.');
      return;
    }
    const canvas = canvasRef.current;
    const signature = canvas ? canvas.toDataURL('image/png') : '';

    // Get current user information
    const userDataStr = localStorage.getItem('user_data');
    let userData = null;
    if (userDataStr) {
      try {
        userData = JSON.parse(userDataStr);
      } catch {}
    }

    // Create metadata for Avtalegiro flow
    const metadata = {
      tags: {
        source: "avtalegiro_contact",
        timestamp: new Date().toISOString()
      },
      status: "ja",
      user_name: userData?.user_info?.name || userData?.username || "Unknown User",
      user_type: userData?.user_type || "employee",
      campaign_id: campaign.id,
      recorded_at: new Date().toISOString(),
      address_text: form.address_text,
      campaign_name: campaign.name
    };

    const payload = {
      ...form,
      campaign: campaign.id,
      status: 'not_done',
      signature,
      metadata: metadata
    };
    // Get access token for Authorization header
    let token = null;
    try {
      const tokens = localStorage.getItem('auth_tokens');
      if (tokens) {
        const parsed = JSON.parse(tokens);
        token = parsed.access;
      }
    } catch {}
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/campaigns/campaign-forms/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let errorMsg = 'Kunne ikke registrere salget.';
        let fieldErrs: Record<string, string[]> = {};
        try {
          const data = await res.json();
          if (typeof data === 'object' && data !== null) {
            if (data.detail) errorMsg = data.detail;
            // Collect field errors
            Object.keys(data).forEach(key => {
              if (Array.isArray(data[key])) {
                fieldErrs[key] = data[key];
              }
            });
          }
        } catch {}
        setError(errorMsg);
        setFieldErrors(fieldErrs);
        return;
      }

      // Log Avtalegiro Contact Activity with metadata
      const selectedCampaign = getCampaignFromStorage();
      if (selectedCampaign) {
        try {
          const activityPayload = {
            activity_type: "avtalegiro_contact",
            description: "Avtalegiro agreement signed for monthly donations",
            campaign_id: selectedCampaign.id,
            metadata: metadata
          };

          const activityResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/activities/`, {
            method: 'POST',
            headers,
            body: JSON.stringify(activityPayload),
          });

          if (!activityResponse.ok) {
            console.warn('Failed to log Avtalegiro activity, but form submission was successful');
          }
        } catch (error) {
          console.warn('Error logging Avtalegiro activity:', error);
        }
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setForm(initialForm);
        clearSignature();
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Noe gikk galt.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep('selection');
    setForm(initialForm);
    setError('');
    setFieldErrors({});
    setShowSuccess(false);
    setSubmitting(false);
    setHasSignature(false);
    clearSignature();
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-full p-6 sm:p-8 rounded-2xl shadow-2xl bg-ab-overlay border border-ab-line">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold tracking-tight text-ab-fg">Registrer salg manuelt</DialogTitle>
        </DialogHeader>

        {currentStep === 'selection' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-ab-fg mb-2">Velg betalingsmetode</h3>
              <p className="text-ab-fg-2 text-sm">Velg hvordan du vil registrere salget</p>
            </div>
            
            <div className="space-y-4">
              <Button
                onClick={() => handleStepSelection('avtalegiro')}
                className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg py-4 text-base font-semibold transition flex items-center justify-center gap-2"
                disabled={submitting}
              >
                <CreditCard className="w-5 h-5" />
                Avtalegiro
                <ArrowRight className="w-4 h-4" />
              </Button>
              
              <Button
                onClick={() => handleStepSelection('vipps')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-4 text-base font-semibold transition flex items-center justify-center gap-2"
                disabled={submitting}
              >
                <div className="w-5 h-5 bg-white rounded flex items-center justify-center">
                  <span className="text-orange-500 font-bold text-xs">V</span>
                </div>
                Fortsett med Vipps
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'avtalegiro' && (
          <>
            {showSuccess ? (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="text-green-600 w-16 h-16 animate-bounceIn mb-4" />
                <div className="text-lg font-semibold text-green-700">Skjema sendt inn!</div>
              </div>
            ) : (
            <>
            {error && <div className="text-red-500 text-sm mb-3 font-medium">{error}</div>}
            {Object.keys(fieldErrors).length > 0 && (
              <div className="mb-3">
                {Object.entries(fieldErrors).map(([field, messages]) => (
                  <div key={field} className="text-red-500 text-xs font-medium">
                    {messages.map((msg, i) => <div key={i}>{msg}</div>)}
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="Fornavn" value={form.first_name} onChange={e => handleChange('first_name', e.target.value)} required className="rounded-lg border border-ab-line bg-ab-elevated focus:border-ab-line-2 focus:ring-2 focus:ring-ab-line text-ab-fg placeholder:text-ab-fg-3" />
                <Input placeholder="Etternavn" value={form.last_name} onChange={e => handleChange('last_name', e.target.value)} required className="rounded-lg border border-ab-line bg-ab-elevated focus:border-ab-line-2 focus:ring-2 focus:ring-ab-line text-ab-fg placeholder:text-ab-fg-3" />
                <Input placeholder="E-post" type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} required className="rounded-lg border border-ab-line bg-ab-elevated focus:border-ab-line-2 focus:ring-2 focus:ring-ab-line text-ab-fg placeholder:text-ab-fg-3" />
                <Input placeholder="Mobilnummer" value={form.sms_phone_number} onChange={e => handleChange('sms_phone_number', e.target.value)} required className="rounded-lg border border-ab-line bg-ab-elevated focus:border-ab-line-2 focus:ring-2 focus:ring-ab-line text-ab-fg placeholder:text-ab-fg-3" />
                <Input placeholder="Fødselsdato" type="date" value={form.date_of_birth} onChange={e => handleChange('date_of_birth', e.target.value)} required className="rounded-lg border border-ab-line bg-ab-elevated focus:border-ab-line-2 focus:ring-2 focus:ring-ab-line text-ab-fg placeholder:text-ab-fg-3" />
                <Input placeholder="Adresse" value={form.address_text} onChange={e => handleChange('address_text', e.target.value)} required className="rounded-lg border border-ab-line bg-ab-elevated focus:border-ab-line-2 focus:ring-2 focus:ring-ab-line text-ab-fg placeholder:text-ab-fg-3" />
                <Input placeholder="Postnummer" value={form.postnummer} onChange={e => handleChange('postnummer', e.target.value)} required className="rounded-lg border border-ab-line bg-ab-elevated focus:border-ab-line-2 focus:ring-2 focus:ring-ab-line text-ab-fg placeholder:text-ab-fg-3" />
                <Input placeholder="Poststed" value={form.posted} onChange={e => handleChange('posted', e.target.value)} required className="rounded-lg border border-ab-line bg-ab-elevated focus:border-ab-line-2 focus:ring-2 focus:ring-ab-line text-ab-fg placeholder:text-ab-fg-3" />
                <Input placeholder="Kontonummer" value={form.kontonummer} onChange={e => handleChange('kontonummer', e.target.value)} required className="rounded-lg border border-ab-line bg-ab-elevated focus:border-ab-line-2 focus:ring-2 focus:ring-ab-line text-ab-fg placeholder:text-ab-fg-3" />
                <Input placeholder="Gavebeløp" type="number" value={form.gavebeløp} onChange={e => handleChange('gavebeløp', e.target.value)} required className="rounded-lg border border-ab-line bg-ab-elevated focus:border-ab-line-2 focus:ring-2 focus:ring-ab-line text-ab-fg placeholder:text-ab-fg-3" />
                <Input placeholder="Beløpsgrense" type="number" value={form.beløpsgrense} onChange={e => handleChange('beløpsgrense', e.target.value)} className="rounded-lg border border-ab-line bg-ab-elevated focus:border-ab-line-2 focus:ring-2 focus:ring-ab-line text-ab-fg placeholder:text-ab-fg-3" />
                <Input placeholder="Skattefradrag Fødselsnummer" value={form.skattefradrag_fødselsnummer} onChange={e => handleChange('skattefradrag_fødselsnummer', e.target.value)} className="rounded-lg border border-ab-line bg-ab-elevated focus:border-ab-line-2 focus:ring-2 focus:ring-ab-line text-ab-fg placeholder:text-ab-fg-3" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.skip} onChange={e => handleChange('skip', e.target.checked)} id="skip" className="accent-black w-4 h-4" />
                <label htmlFor="skip" className="text-sm text-ab-fg select-none">Hopp over varsler</label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-ab-fg">Signatur</label>
                <div className="border border-ab-line rounded-lg bg-ab-subtle p-2 flex flex-col items-center">
                  <canvas
                    ref={canvasRef}
                    width={420}
                    height={120}
                    className="w-full h-32 border border-ab-line bg-white rounded-lg cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{ touchAction: 'none' }}
                  />
                  <Button type="button" variant="ghost" size="sm" className="mt-2 text-ab-fg hover:bg-ab-hover" onClick={clearSignature}>Tøm signatur</Button>
                </div>
              </div>
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCurrentStep('selection')}
                  className="flex-1 border-ab-line text-ab-fg hover:bg-ab-hover rounded-lg py-3"
                >
                  Tilbake
                </Button>
                <Button type="submit" className="flex-1 bg-black text-white hover:bg-black/90 rounded-lg py-3 text-base font-semibold tracking-tight transition" disabled={submitting || !hasSignature}>
                  {submitting ? 'Sender...' : 'Registrer salg manuelt'}
                </Button>
              </div>
            </form>
            </>) }
          </>
        )}

        {currentStep === 'vipps' && submitting && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
            <div className="text-lg font-semibold text-ab-fg">Behandler VIPPS betaling...</div>
            <p className="text-ab-fg-2 text-sm mt-2">Du vil bli omdirigert til VIPPS snart</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 