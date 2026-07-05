import React, { useState, useRef, useEffect } from 'react';
import { FaTimes, FaSignature, FaTrash, FaUser, FaMapMarkerAlt, FaCreditCard, FaPen, FaArrowRight } from 'react-icons/fa';
import { createCampaignForm, validateFormData, getCampaignById } from '../../services/campaignFormService';
import './CampaignFormPopup.css';

const CampaignFormPopup = ({ 
  isOpen, 
  onClose, 
  campaignId, 
  addressId, 
  salesRepId,
  addressData = null 
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState('selection'); // 'selection', 'avtalegiro', 'vipps'
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupSuccess, setLookupSuccess] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState(new Set());

  // ============================================================================
  // PHASE 1: MULTI-STEP FORM STATE MANAGEMENT
  // ============================================================================
  
  // Multi-step navigation state
  const [currentSection, setCurrentSection] = useState(0); // 0-4 for 5 sections
  const [completedSections, setCompletedSections] = useState(new Set());
  const [sectionValidation, setSectionValidation] = useState({
    0: false, // Telefonnummeroppslag (optional, always valid)
    1: false, // Personlig informasjon
    2: false, // Adresse
    3: false, // Informasjon
    4: false  // Signatur
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // PHASE 7: Toast notification state
  const [toast, setToast] = useState({ show: false, message: '' });
  
  // Section names for reference
  const SECTION_NAMES = ['Telefonnummeroppslag', 'Personlig informasjon', 'Adresse', 'Informasjon', 'Signatur'];
  const TOTAL_SECTIONS = 5;
  
  // PHASE 7: Reduced motion support for accessibility
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ANIMATION_DURATION = prefersReducedMotion ? 0 : 400; // 0ms if reduced motion, 400ms normal

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    sms_phone_number: '',
    date_of_birth: '',
    address_text: '',
    postnummer: '',
    posted: '',
    kontonummer: '',
    gavebeløp: '325',
    beløpsgrense: '',
    skattefradrag_fødselsnummer: '',
    skip: false,
    signature: ''
  });

  // Check if campaign is "Norsk folkehjelp" - only show popup for this campaign
  const isNorskFolkehjelp = currentCampaign?.name?.toLowerCase().trim() === "norsk folkehjelp";

  // Load campaign data from localStorage or API - NON-BLOCKING
  useEffect(() => {
    const loadCampaign = async () => {
      if (!campaignId) return;

      try {
        // Try to get campaign from localStorage first (INSTANT)
        const storedCampaign = localStorage.getItem('currentCampaign');
        
        if (storedCampaign) {
          try {
            const parsedCampaign = JSON.parse(storedCampaign);
            
            // Verify the stored campaign matches the current campaignId
            if (parsedCampaign.id === campaignId) {
              // Perfect match! Use it immediately
              setCurrentCampaign(parsedCampaign);
              
              // Validate campaign type
              if (parsedCampaign.name.toLowerCase().trim() !== "norsk folkehjelp") {
                onClose();
              }
              return; // Done! No API call needed
            }
          } catch (parseError) {
            console.warn('Failed to parse stored campaign:', parseError);
            // Continue to API fallback
          }
        }

        // If not in localStorage or ID doesn't match, show loading state
        setCurrentCampaign({ name: 'loading', id: campaignId });

        // Fetch from API as fallback (non-blocking)
        const campaign = await getCampaignById(campaignId);
        
        // Update state with real data
        setCurrentCampaign(campaign);
        
        // Validate campaign type
        if (campaign.name.toLowerCase().trim() !== "norsk folkehjelp") {
          onClose();
        }
      } catch (error) {
        console.error('Error loading campaign:', error);
        // On error, close the popup
        onClose();
      }
    };
    
    if (isOpen && campaignId) {
      loadCampaign();
    }
  }, [isOpen, campaignId, onClose]);

  // Reset form state when popup opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('selection');
      setError('');
      setFieldErrors({});
      setShowSuccess(false);
      setIsSubmitting(false);
      setHasSignature(false);
      setIsLookingUp(false);
      setLookupError('');
      setLookupSuccess(false);
      setAutoFilledFields(new Set());
      
      // PHASE 1: Reset multi-step state
      setCurrentSection(0);
      setCompletedSections(new Set());
      setSectionValidation({
        0: false,
        1: false,
        2: false,
        3: false,
        4: false
      });
      setIsTransitioning(false);
      
      console.log('[Form Reset] Multi-step form state reset to initial values');
      
      // Always reset form data when popup opens
      const initialFormData = {
        first_name: '',
        last_name: '',
        email: '',
        sms_phone_number: '',
        date_of_birth: '',
        address_text: '',
        postnummer: '',
        posted: '',
        kontonummer: '',
        gavebeløp: '325',
        beløpsgrense: '',
        skattefradrag_fødselsnummer: '',
        skip: false,
        signature: ''
      };
      
      // If address data is provided, update the address fields
      if (addressData) {
        initialFormData.address_text = addressData.address_text || '';
        initialFormData.postnummer = addressData.postnummer || '';
        initialFormData.posted = addressData.posted || '';
      }
      
      setFormData(initialFormData);
      
      // Clear signature after a small delay to ensure canvas is initialized
      setTimeout(() => {
        clearSignature();
      }, 100);
    }
  }, [isOpen, addressData]);



  // Initialize canvas with proper sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && isOpen) {
      const initializeCanvas = () => {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Get the display size of the canvas
          const rect = canvas.getBoundingClientRect();
          
          // Get device pixel ratio for crisp rendering
          const dpr = window.devicePixelRatio || 1;
          
          // Set the canvas size accounting for device pixel ratio
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          
          // Set the CSS size to maintain the visual size
          canvas.style.width = rect.width + 'px';
          canvas.style.height = rect.height + 'px';
          
          // Scale the context to account for device pixel ratio
          ctx.scale(dpr, dpr);

          // Configure the drawing context
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      };

      // Initialize with a small delay to ensure proper rendering
      setTimeout(() => {
        initializeCanvas();
      }, 100);
      
      // Add resize listener for responsive behavior
      const handleResize = () => {
        if (canvas && isOpen) {
          setTimeout(() => {
            initializeCanvas();
          }, 100);
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

  // ============================================================================
  // PHASE 1: SECTION VALIDATION LOGIC
  // ============================================================================
  
  /**
   * Validates a specific section based on its index
   * @param {number} sectionIndex - The section to validate (0-4)
   * @returns {boolean} - Whether the section is valid
   */
  const validateSection = (sectionIndex) => {
    switch (sectionIndex) {
      case 0: // Telefonnummeroppslag Section
        // Phone lookup is optional, but if a number is entered, it should be 8 digits
        if (formData.sms_phone_number && formData.sms_phone_number.length > 0) {
          return /^\d{8}$/.test(formData.sms_phone_number);
        }
        // Empty is also valid (can skip lookup)
        return true;
      
      case 1: // Personlig informasjon Section
        return (
          formData.first_name?.trim().length > 0 &&
          formData.last_name?.trim().length > 0 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
          formData.date_of_birth?.length > 0
        );
      
      case 2: // Adresse Section
        return (
          formData.address_text?.trim().length > 0 &&
          /^\d{4}$/.test(formData.postnummer) &&
          formData.posted?.trim().length > 0
        );
      
      case 3: // Informasjon Section
        const hasValidAccountNumber = /^\d{11}$/.test(formData.kontonummer);
        const hasValidDonationAmount = parseFloat(formData.gavebeløp) > 0;
        const hasValidTaxId = !formData.skattefradrag_fødselsnummer || 
                              /^\d{11}$/.test(formData.skattefradrag_fødselsnummer);
        const hasValidAmountLimit = !formData.beløpsgrense || 
                                    parseFloat(formData.beløpsgrense) > 0;
        
        return hasValidAccountNumber && hasValidDonationAmount && 
               hasValidTaxId && hasValidAmountLimit;
      
      case 4: // Signatur Section
        return hasSignature;
      
      default:
        return false;
    }
  };

  // ============================================================================
  // PHASE 7: TOAST NOTIFICATION FUNCTION
  // ============================================================================
  
  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {number} duration - Duration in milliseconds (default: 2500)
   */
  const showToast = (message, duration = 2500) => {
    setToast({ show: true, message });
    
    // Auto-hide after duration
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, duration);
  };

  // ============================================================================
  // PHASE 1: NAVIGATION FUNCTIONS
  // ============================================================================
  
  /**
   * Navigate to a specific section
   * @param {number} targetSection - The section index to navigate to (0-4)
   */
  const goToSection = (targetSection) => {
    // Prevent navigation during transitions
    if (isTransitioning) {
      console.log('[Navigation] Blocked: Transition in progress');
      return;
    }
    
    // Validate section bounds
    if (targetSection < 0 || targetSection >= TOTAL_SECTIONS) {
      console.error('[Navigation] Invalid section:', targetSection);
      return;
    }
    
    // If moving forward, validate current section first
    if (targetSection > currentSection) {
      const isCurrentSectionValid = validateSection(currentSection);
      if (!isCurrentSectionValid) {
        console.log('[Navigation] Blocked: Current section invalid');
        setError(`Please complete all required fields in ${SECTION_NAMES[currentSection]}`);
        setTimeout(() => setError(''), 3000);
        return;
      }
      
      // Mark current section as completed
      setCompletedSections(prev => {
        const newSet = new Set(prev);
        newSet.add(currentSection);
        return newSet;
      });
    }
    
    // Clear any errors
    setError('');
    
    // Start transition
    setIsTransitioning(true);
    
    console.log(`[Navigation] Moving from section ${currentSection} to ${targetSection}`);
    
    // Update current section
    setCurrentSection(targetSection);
    
    // End transition after animation duration
    setTimeout(() => {
      setIsTransitioning(false);
      console.log('[Navigation] Transition complete');
    }, ANIMATION_DURATION); // PHASE 7: Uses reduced motion setting
  };
  
  /**
   * Navigate to the next section
   */
  const goToNextSection = () => {
    if (currentSection < TOTAL_SECTIONS - 1) {
      // PHASE 7: Show toast notification when section is complete
      showToast(`✓ ${SECTION_NAMES[currentSection]} completed!`);
      goToSection(currentSection + 1);
    }
  };
  
  /**
   * Navigate to the previous section
   */
  const goToPreviousSection = () => {
    if (currentSection > 0) {
      goToSection(currentSection - 1);
    }
  };
  
  /**
   * Mark a section as completed
   * @param {number} sectionIndex - The section to mark complete
   */
  const markSectionComplete = (sectionIndex) => {
    setCompletedSections(prev => {
      const newSet = new Set(prev);
      newSet.add(sectionIndex);
      return newSet;
    });
  };

  // ============================================================================
  // PHASE 1: REAL-TIME VALIDATION UPDATE
  // ============================================================================
  
  /**
   * Update validation state whenever form data or signature changes
   */
  useEffect(() => {
    const isValid = validateSection(currentSection);
    setSectionValidation(prev => ({
      ...prev,
      [currentSection]: isValid
    }));
    
    console.log(`[Validation] Section ${currentSection} (${SECTION_NAMES[currentSection]}): ${isValid ? 'Valid' : 'Invalid'}`);
  }, [formData, currentSection, hasSignature]);
  
  /**
   * Log section changes for debugging
   */
  useEffect(() => {
    if (currentSection >= 0 && currentSection < TOTAL_SECTIONS) {
      console.log(`[Section Change] Now viewing: Section ${currentSection} - ${SECTION_NAMES[currentSection]}`);
      console.log(`[Section Change] Completed sections:`, Array.from(completedSections));
      console.log(`[Section Change] Validation status:`, sectionValidation);
    }
  }, [currentSection]);

  /**
   * PHASE 7: Keyboard navigation handler
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Don't handle keyboard shortcuts when typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }

      // ESC to close
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      // Arrow navigation (only if not transitioning)
      if (!isTransitioning) {
        if (e.key === 'ArrowLeft' && currentSection > 0) {
          e.preventDefault();
          goToPreviousSection();
        } else if (e.key === 'ArrowRight' && currentSection < TOTAL_SECTIONS - 1 && sectionValidation[currentSection]) {
          e.preventDefault();
          goToNextSection();
        }
      }

      // Enter to submit on last section if valid
      if (e.key === 'Enter' && currentSection === TOTAL_SECTIONS - 1 && sectionValidation[currentSection] && !isSubmitting) {
        e.preventDefault();
        document.querySelector('.submit-btn')?.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSection, sectionValidation, isTransitioning, isSubmitting]);

  // ============================================================================
  // EXISTING HANDLERS (PRESERVED)
  // ============================================================================

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasSignature(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        let clientX, clientY;
        if (e.touches) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          clientX = e.clientX;
          clientY = e.clientY;
        }

        // Calculate the correct coordinates relative to the canvas
        // Account for any CSS transforms or borders
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        let clientX, clientY;
        if (e.touches) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          clientX = e.clientX;
          clientY = e.clientY;
        }

        // Calculate the correct coordinates relative to the canvas
        // Account for any CSS transforms or borders
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

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

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Remove from auto-filled set if user manually edits
    if (autoFilledFields.has(field)) {
      const newAutoFilled = new Set(autoFilledFields);
      newAutoFilled.delete(field);
      setAutoFilledFields(newAutoFilled);
    }
  };

  const handlePhoneLookup = async () => {
    // Validate phone number format (8 digits for Norwegian numbers)
    const phoneNumber = formData.sms_phone_number.trim();
    if (!phoneNumber || phoneNumber.length !== 8 || !/^\d{8}$/.test(phoneNumber)) {
      setLookupError('Vennligst skriv inn et gyldig 8-sifret telefonnummer');
      return;
    }

    setIsLookingUp(true);
    setLookupError('');
    setLookupSuccess(false);

    try {
      const response = await fetch(`https://services.api1881.no/lookup/phonenumber/${phoneNumber}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Ocp-Apim-Subscription-Key': '499113b3b1ef458ebf1ba067ce7ce3ab'
        }
      });

      if (!response.ok) {
        throw new Error('Kunne ikke finne informasjon for dette telefonnummeret');
      }

      const data = await response.json();

      // Check if we have contacts
      if (!data.contacts || data.contacts.length === 0) {
        throw new Error('Ingen informasjon funnet for dette telefonnummeret');
      }

      const contact = data.contacts[0];
      const newAutoFilled = new Set();

      // Auto-fill fields from API response
      const updates = {};

      if (contact.firstName) {
        updates.first_name = contact.firstName;
        newAutoFilled.add('first_name');
      }

      if (contact.lastName) {
        updates.last_name = contact.lastName;
        newAutoFilled.add('last_name');
      }

      if (contact.geography?.address) {
        const address = contact.geography.address;
        
        if (address.addressString) {
          updates.address_text = address.addressString;
          newAutoFilled.add('address_text');
        }

        if (address.postCode) {
          updates.postnummer = address.postCode;
          newAutoFilled.add('postnummer');
        }

        if (address.postArea) {
          updates.posted = address.postArea;
          newAutoFilled.add('posted');
        }
      }

      // Update form data with all auto-filled fields
      setFormData(prev => ({ ...prev, ...updates }));
      setAutoFilledFields(newAutoFilled);
      setLookupSuccess(true); // Hide skip option after successful lookup
      
      // PHASE 7: Show toast notification instead of inline success message
      const autoFilledCount = newAutoFilled.size;
      showToast(`✓ ${autoFilledCount} felt${autoFilledCount !== 1 ? 'er' : ''} fylt ut automatisk!`);
      
      // PHASE 6: Enhanced section completion tracking
      console.log('[Telefonnummeroppslag] Auto-filled fields:', Array.from(newAutoFilled));
      
      // Always mark Telefonnummeroppslag section (0) as completed
      markSectionComplete(0);
      
      // Check if we have enough data to mark Personlig informasjon section (1) as complete
      // Need: first_name, last_name (email and date_of_birth still required from user)
      const hasPersonalInfo = updates.first_name && updates.last_name;
      
      // Check if we have enough data to mark Adresse section (2) as complete
      const hasAddressInfo = updates.address_text && updates.postnummer && updates.posted;
      
      if (hasPersonalInfo) {
        console.log('[Telefonnummeroppslag] ✓ Personlig informasjon auto-filled - Section 1 data ready');
        // Note: Section 1 won't be fully valid until email and DOB are filled
      }
      
      if (hasAddressInfo) {
        console.log('[Telefonnummeroppslag] ✓ Adresse info auto-filled - Section 2 complete');
        // Adresse section is fully complete since all fields are auto-filled
        markSectionComplete(2);
      }

      // Log success
      console.log(`[Telefonnummeroppslag] Successfully auto-filled ${autoFilledCount} fields`);
      
      // PHASE 6: Auto-advance to next section after successful lookup
      // Keep lookupSuccess true to hide skip option
      setTimeout(() => {
        if (currentSection === 0) {
          console.log('[Telefonnummeroppslag] Auto-advancing to Personlig informasjon section');
          goToSection(1);
        }
      }, 1500);

    } catch (error) {
      console.error('Telefonnummeroppslag error:', error);
      setLookupError(error.message || 'Noe gikk galt ved oppslag. Vennligst prøv igjen.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleStepSelection = (step) => {
    setCurrentStep(step);
    if (step === 'vipps') {
      handleVippsFlow();
    }
  };

  const handleVippsFlow = async () => {
    setIsSubmitting(true);
    setError('');
    
    try {
      // (Removed) the /dashboard/activities/ POST — that endpoint isn't part of the
      // activity API surface (only /dashboard/activities/{filtered,summary}/ exist) and
      // the call 404'd; Vipps contact is not logged via a maps activity anymore.

      // Close the popup first to ensure state is cleared
      onClose();

      // Redirect to VIPPS page
      window.open('https://folkehjelp.no/d2d-2', '_blank');

    } catch (err) {
      setError(err.message || 'Noe gikk galt med VIPPS prosessering.');
      setCurrentStep('selection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!campaignId) {
      setError('Kampanje ID mangler');
      return;
    }



    // Validate form data
    const validation = validateFormData(formData);
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Get current user information from localStorage
      const userDataStr = localStorage.getItem('user_data');
      let userData = null;
      if (userDataStr) {
        try {
          userData = JSON.parse(userDataStr);
        } catch {}
      }

      // Get signature as base64
      const canvas = canvasRef.current;
      const signature = canvas ? canvas.toDataURL('image/png') : '';

      // Create metadata for Avtalegiro flow
      const metadata = {
        tags: {
          source: "avtalegiro_contact",
          timestamp: new Date().toISOString()
        },
        status: "ja",
        user_name: userData?.user_info?.name || userData?.username || "Unknown User",
        user_type: userData?.user_type || "manager",
        campaign_id: campaignId,
        recorded_at: new Date().toISOString(),
        address_text: formData.address_text,
        campaign_name: currentCampaign?.name || "Unknown Campaign"
      };

      const payload = {
        campaign: campaignId,
        address: addressId,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        sms_phone_number: formData.sms_phone_number,
        date_of_birth: formData.date_of_birth,
        address_text: formData.address_text,
        postnummer: formData.postnummer,
        posted: formData.posted,
        kontonummer: formData.kontonummer,
        gavebeløp: parseFloat(formData.gavebeløp),
        beløpsgrense: formData.beløpsgrense ? parseFloat(formData.beløpsgrense) : null,
        skattefradrag_fødselsnummer: formData.skattefradrag_fødselsnummer,
        skip: formData.skip,
        signature: signature,
        metadata: metadata
      };

      await createCampaignForm(payload);
      
      // Success - show success message and close
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1800);
    } catch (error) {
      setError(error.message || 'Det oppstod en feil ved innsending av skjemaet. Vennligst prøv igjen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep('selection');
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      sms_phone_number: '',
      date_of_birth: '',
      address_text: addressData?.address_text || '',
      postnummer: addressData?.postnummer || '',
      posted: addressData?.posted || '',
      kontonummer: '',
      gavebeløp: '325',
      beløpsgrense: '',
      skattefradrag_fødselsnummer: '',
      skip: false,
      signature: ''
    });
    setError('');
    setFieldErrors({});
    setShowSuccess(false);
    setIsLookingUp(false);
    setLookupError('');
    setLookupSuccess(false);
    setAutoFilledFields(new Set());
    
    // PHASE 1: Reset multi-step state on close
    setCurrentSection(0);
    setCompletedSections(new Set());
    setSectionValidation({
      0: false,
      1: false,
      2: false,
      3: false,
      4: false
    });
    setIsTransitioning(false);
    
    clearSignature();
    onClose();
    
    console.log('[Form Close] All state reset, popup closed');
  };

  // Don't show popup if not open
  if (!isOpen) return null;
  
  // Allow showing popup while loading campaign data (don't block on isNorskFolkehjelp check)
  // The validation will happen in the background and close if needed
  const isLoadingCampaign = currentCampaign?.name === 'loading';
  const shouldShowPopup = isLoadingCampaign || isNorskFolkehjelp;
  
  if (!shouldShowPopup && currentCampaign) return null;

  return (
    <>
      {/* PHASE 7: Toast Notification */}
      {toast.show && (
        <div className="toast-notification show">
          <div className="toast-icon">✓</div>
          <span>{toast.message}</span>
        </div>
      )}
      
      <div className="campaign-form-overlay">
      <div className={`campaign-form-popup ${currentStep === 'selection' ? 'selection-mode' : 'form-mode'}`}>
        <div className="campaign-form-header">
          <h2>Registrer Salg</h2>
          <button className="close-button" onClick={handleClose}>
            <FaTimes />
          </button>
        </div>

        {currentStep === 'selection' && (
          <div className="selection-step">
            <div className="selection-content">
              <h3>Velg betalingsmetode</h3>
              <p>Velg hvordan du vil registrere salget</p>
              
              <div className="payment-options">
                <button
                  onClick={() => handleStepSelection('avtalegiro')}
                  className="payment-option avtalegiro"
                  disabled={isSubmitting}
                >
                  <FaCreditCard />
                  <span>Avtalegiro</span>
                  <FaArrowRight />
                </button>
                
                <button
                  onClick={() => handleStepSelection('vipps')}
                  className="payment-option vipps"
                  disabled={isSubmitting}
                >
                  <div className="vipps-icon">V</div>
                  <span>Fortsett med Vipps</span>
                  <FaArrowRight />
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'avtalegiro' && (
          <>
            {/* PHASE 2: PROGRESS BAR */}
            {!showSuccess && (
              <div className="progress-bar-container">
                <div className="progress-bar">
                  {/* Progress line background */}
                  <div className="progress-line">
                    <div 
                      className="progress-line-fill" 
                      style={{ 
                        width: `${(currentSection / (TOTAL_SECTIONS - 1)) * 100}%` 
                      }}
                    />
                  </div>
                  
                  {/* Progress dots */}
                  <div className="progress-dots">
                    {Array.from({ length: TOTAL_SECTIONS }).map((_, index) => (
                      <div
                        key={index}
                        className={`progress-dot ${
                          index === currentSection ? 'active' : ''
                        } ${completedSections.has(index) ? 'completed' : ''}`}
                        title={SECTION_NAMES[index]}
                      >
                        {completedSections.has(index) ? (
                          <span className="checkmark">✓</span>
                        ) : (
                          <span className="step-number">{index + 1}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Current section label */}
                  <div className="progress-label">
                    <span className="section-name">{SECTION_NAMES[currentSection]}</span>
                    <span className="section-counter">
                      {currentSection + 1} / {TOTAL_SECTIONS}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {showSuccess ? (
              <div className="success-message">
                <div className="success-icon">✓</div>
                <div className="success-text">Skjema sendt inn!</div>
              </div>
            ) : (
              <>
                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="campaign-form">
                  {/* PHASE 3: SLIDING SECTIONS CONTAINER */}
                  <div 
                    className="sections-container"
                    style={{
                      transform: `translateX(-${currentSection * (100 / TOTAL_SECTIONS)}%)`,
                      transition: isTransitioning ? `transform ${ANIMATION_DURATION}ms cubic-bezier(0.4, 0.0, 0.2, 1)` : 'none'
                    }}
                  >
                    {/* SECTION 0: Telefonnummeroppslag */}
                    <div className="form-section-wrapper">
                      <div className={`form-section phone-lookup-section ${sectionValidation[0] ? 'section-valid' : 'section-invalid'}`}>
                    <h3><span className="section-title-content">Telefonnummeroppslag</span></h3>
                    <p className="lookup-description">Skriv inn telefonnummer for å hente informasjon automatisk</p>
                    
                    <div className="phone-lookup-row">
                      <div className="form-group required" style={{ marginBottom: 0 }}>
                        <label htmlFor="phone_lookup">Mobilnummer</label>
                        <input
                          id="phone_lookup"
                          type="tel"
                          value={formData.sms_phone_number}
                          onChange={(e) => handleInputChange('sms_phone_number', e.target.value)}
                          placeholder="12345678"
                          maxLength="8"
                          pattern="\d{8}"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handlePhoneLookup}
                        disabled={isLookingUp || !formData.sms_phone_number || formData.sms_phone_number.length !== 8}
                        className="finn-btn"
                      >
                        {isLookingUp ? 'Søker...' : 'Finn'}
                      </button>
                    </div>

                    {lookupError && (
                      <div className="lookup-error">
                        ⚠️ {lookupError}
                      </div>
                    )}
                    
                    {/* PHASE 6: Skip lookup option */}
                    {!lookupSuccess && !isLookingUp && (
                      <div className="lookup-skip">
                        <p className="skip-text">
                          Ønsker du å hoppe over? Du kan fylle ut informasjonen manuelt i neste steg.
                        </p>
                      </div>
                    )}
                      </div>
                    </div> {/* End Section 0: Telefonnummeroppslag */}

                    {/* SECTION 1: Personlig informasjon */}
                    <div className="form-section-wrapper">
                      <div className={`form-section ${sectionValidation[1] ? 'section-valid' : 'section-invalid'}`}>
                        <h3><span className="section-title-content"><FaUser /> Personlig informasjon</span></h3>
                    <div className="form-row">
                      <div className="form-group required">
                        <label htmlFor="first_name">
                          Fornavn
                          {autoFilledFields.has('first_name') && <span className="auto-fill-badge">Auto</span>}
                        </label>
                        <input
                          id="first_name"
                          type="text"
                          value={formData.first_name}
                          onChange={(e) => handleInputChange('first_name', e.target.value)}
                          required
                          placeholder="Skriv fornavn"
                          className={autoFilledFields.has('first_name') ? 'auto-filled' : ''}
                        />
                      </div>
                      <div className="form-group required">
                        <label htmlFor="last_name">
                          Etternavn
                          {autoFilledFields.has('last_name') && <span className="auto-fill-badge">Auto</span>}
                        </label>
                        <input
                          id="last_name"
                          type="text"
                          value={formData.last_name}
                          onChange={(e) => handleInputChange('last_name', e.target.value)}
                          required
                          placeholder="Skriv etternavn"
                          className={autoFilledFields.has('last_name') ? 'auto-filled' : ''}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group required">
                        <label htmlFor="email">E-post</label>
                        <input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          required
                          placeholder="din.epost@eksempel.no"
                        />
                      </div>
                      <div className="form-group required">
                        <label htmlFor="date_of_birth">Fødselsdato</label>
                        <input
                          id="date_of_birth"
                          type="date"
                          value={formData.date_of_birth}
                          onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                      </div>
                    </div> {/* End Section 1: Personlig informasjon */}

                    {/* SECTION 2: Adresse */}
                    <div className="form-section-wrapper">
                      <div className={`form-section ${sectionValidation[2] ? 'section-valid' : 'section-invalid'}`}>
                        <h3><span className="section-title-content"><FaMapMarkerAlt /> Adresse</span></h3>
                    <div className="form-group required">
                      <label htmlFor="address_text">
                        Adresse
                        {autoFilledFields.has('address_text') && <span className="auto-fill-badge">Auto</span>}
                      </label>
                      <input
                        id="address_text"
                        type="text"
                        value={formData.address_text}
                        onChange={(e) => handleInputChange('address_text', e.target.value)}
                        required
                        placeholder="Gateadresse og postnummer"
                        className={autoFilledFields.has('address_text') ? 'auto-filled' : ''}
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group required">
                        <label htmlFor="postnummer">
                          Postnummer
                          {autoFilledFields.has('postnummer') && <span className="auto-fill-badge">Auto</span>}
                        </label>
                        <input
                          id="postnummer"
                          type="text"
                          value={formData.postnummer}
                          onChange={(e) => handleInputChange('postnummer', e.target.value)}
                          required
                          placeholder="0000"
                          className={autoFilledFields.has('postnummer') ? 'auto-filled' : ''}
                        />
                      </div>
                      <div className="form-group required">
                        <label htmlFor="posted">
                          Poststed
                          {autoFilledFields.has('posted') && <span className="auto-fill-badge">Auto</span>}
                        </label>
                        <input
                          id="posted"
                          type="text"
                          value={formData.posted}
                          onChange={(e) => handleInputChange('posted', e.target.value)}
                          required
                          placeholder="By/sted"
                          className={autoFilledFields.has('posted') ? 'auto-filled' : ''}
                        />
                      </div>
                    </div>
                      </div>
                    </div> {/* End Section 2: Adresse */}

                    {/* SECTION 3: Informasjon */}
                    <div className="form-section-wrapper">
                      <div className={`form-section ${sectionValidation[3] ? 'section-valid' : 'section-invalid'}`}>
                        <h3><span className="section-title-content"><FaCreditCard /> Informasjon</span></h3>
                    <div className="form-group required">
                      <label htmlFor="kontonummer">Kontonummer</label>
                      <input
                        id="kontonummer"
                        type="text"
                        value={formData.kontonummer}
                        onChange={(e) => handleInputChange('kontonummer', e.target.value)}
                        required
                        placeholder="11 siffer kontonummer"
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group required">
                        <label htmlFor="gavebeløp">Gavebeløp</label>
                        <input
                          id="gavebeløp"
                          type="number"
                          step="0.01"
                          value={formData.gavebeløp}
                          onChange={(e) => handleInputChange('gavebeløp', e.target.value)}
                          required
                          placeholder="0.00"
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="beløpsgrense">Beløpsgrense</label>
                        <input
                          id="beløpsgrense"
                          type="number"
                          step="0.01"
                          value={formData.beløpsgrense}
                          onChange={(e) => handleInputChange('beløpsgrense', e.target.value)}
                          placeholder="Valgfri grense"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="skattefradrag_fødselsnummer">Skattefradrag (Fødselsnummer)</label>
                      <input
                        id="skattefradrag_fødselsnummer"
                        type="text"
                        placeholder="11 siffer fødselsnummer"
                        value={formData.skattefradrag_fødselsnummer}
                        onChange={(e) => handleInputChange('skattefradrag_fødselsnummer', e.target.value)}
                      />
                    </div>

                    <div className="form-group checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.skip}
                          onChange={(e) => handleInputChange('skip', e.target.checked)}
                        />
                        <span>Hopp over varsler</span>
                      </label>
                    </div>
                      </div>
                    </div> {/* End Section 3: Informasjon */}

                    {/* SECTION 4: Signatur */}
                    <div className="form-section-wrapper">
                      <div className={`form-section ${sectionValidation[4] ? 'section-valid' : 'section-invalid'}`}>
                        <h3><span className="section-title-content"><FaPen /> Signatur</span></h3>
                    <div className="signature-container">
                      <canvas
                        ref={canvasRef}
                        className={`signature-canvas ${hasSignature ? 'has-signature' : 'no-signature'}`}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        style={{ touchAction: 'none' }}
                      />
                      <div className="signature-controls">
                        <button
                          type="button"
                          onClick={clearSignature}
                          className="clear-signature-btn"
                        >
                          <FaTrash /> Tøm signatur
                        </button>
                      </div>
                    </div>
                      </div>
                    </div> {/* End Section 4: Signatur */}
                  
                  </div> {/* End sections-container */}

                  {/* PHASE 5: NAVIGATION CONTROLS */}
                  <div className="navigation-controls">
                    {/* Back Button - Show on all sections except first */}
                    {currentSection > 0 && (
                      <button
                        type="button"
                        onClick={goToPreviousSection}
                        className="back-btn"
                        disabled={isSubmitting || isTransitioning}
                        title="Gå tilbake til forrige seksjon"
                      >
                        <span className="btn-icon">←</span>
                        <span className="btn-text">Tilbake</span>
                      </button>
                    )}
                    
                    {/* Next Button - Show on all sections except last */}
                    {currentSection < TOTAL_SECTIONS - 1 && (
                      <button
                        type="button"
                        onClick={goToNextSection}
                        className="next-btn"
                        disabled={!sectionValidation[currentSection] || isSubmitting || isTransitioning}
                        title={sectionValidation[currentSection] ? "Gå til neste seksjon" : "Fullfør denne seksjonen først"}
                      >
                        <span className="btn-text">Neste</span>
                        <span className="btn-icon">→</span>
                      </button>
                    )}
                    
                    {/* Submit Button - Show only on last section */}
                    {currentSection === TOTAL_SECTIONS - 1 && (
                      <button
                        type="submit"
                        className="submit-btn"
                        disabled={!sectionValidation[currentSection] || isSubmitting}
                        title={sectionValidation[currentSection] ? "Send inn skjemaet" : "Fullfør denne seksjonen først"}
                      >
                        {isSubmitting ? (
                          <>
                            <span className="btn-spinner"></span>
                            <span className="btn-text">Sender...</span>
                          </>
                        ) : (
                          <>
                            <span className="btn-icon">✓</span>
                            <span className="btn-text">Registrer Salg</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </>
        )}

        {currentStep === 'vipps' && (
          <div className="vipps-loading">
            <div className="loading-spinner"></div>
            <div className="loading-text">Behandler VIPPS betaling...</div>
            <p>Du vil bli omdirigert til VIPPS snart</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default CampaignFormPopup; 