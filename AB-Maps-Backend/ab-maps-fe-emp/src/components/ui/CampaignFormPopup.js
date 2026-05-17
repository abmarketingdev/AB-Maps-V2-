import React, { useState, useRef, useEffect } from 'react';
import { FaTimes, FaSignature, FaTrash, FaUser, FaMapMarkerAlt, FaCreditCard, FaPen } from 'react-icons/fa';
import { createCampaignForm, validateFormData } from '../../services/campaignFormService';
import './CampaignFormPopup.css';

const CampaignFormPopup = ({ 
  isOpen, 
  onClose, 
  campaignId, 
  addressId, 
  salesRepId,
  addressData = null,
  token = null
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    sms_phone_number: '',
    kidnumber: '',
    date_of_birth: '',
    address_text: '',
    postnummer: '',
    posted: '',
    kontonummer: '',
    gavebeløp: '325',
    beløpsgrense: '',
    skattefradrag_fødselsnummer: '',
    personel_number: '',
    skip: false,
    signature: ''
  });

  // Initialize form with address data if available
  useEffect(() => {
    if (addressData) {
      setFormData(prev => ({
        ...prev,
        address_text: addressData.address_text || '',
        postnummer: addressData.postnummer || '',
        posted: addressData.posted || ''
      }));
    }
  }, [addressData]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && isOpen) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [isOpen]);

  const startDrawing = (e) => {
    setIsDrawing(true);
    setHasSignature(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        let clientX, clientY;
        if (e.touches) {
          e.preventDefault();
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          clientX = e.clientX;
          clientY = e.clientY;
        }

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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!hasSignature) {
      setError('Vennligst signer før du fortsetter');
      return;
    }

    if (!campaignId) {
      setError('Kampanje ID mangler');
      return;
    }

    if (!token) {
      setError('Autentisering mangler');
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
      // Get signature as base64
      const canvas = canvasRef.current;
      const signature = canvas ? canvas.toDataURL('image/png') : '';

      const payload = {
        campaign: campaignId,
        address: addressId,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        sms_phone_number: formData.sms_phone_number,
        kidnumber: formData.kidnumber,
        date_of_birth: formData.date_of_birth,
        address_text: formData.address_text,
        postnummer: formData.postnummer,
        posted: formData.posted,
        kontonummer: formData.kontonummer,
        gavebeløp: parseFloat(formData.gavebeløp),
        beløpsgrense: formData.beløpsgrense ? parseFloat(formData.beløpsgrense) : null,
        skattefradrag_fødselsnummer: formData.skattefradrag_fødselsnummer,
        personel_number: formData.personel_number,
        skip: formData.skip,
        signature: signature
      };

      await createCampaignForm(payload, token);
      
      // Success - close popup and show success message
      onClose();
      // You can add a toast notification here
      alert('Skjema sendt inn vellykket!');
    } catch (error) {
      console.error('Error submitting form:', error);
      setError(error.message || 'Det oppstod en feil ved innsending av skjemaet. Vennligst prøv igjen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="campaign-form-overlay">
      <div className="campaign-form-popup">
        <div className="campaign-form-header">
          <h2>Kampanje Skjema</h2>
          <button className="close-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Form Progress Indicator */}
        <div className="form-progress">
          <div className="progress-step active">
            <div>1</div>
            <div>Personlig</div>
          </div>
          <div className="progress-step">
            <div>2</div>
            <div>Adresse</div>
          </div>
          <div className="progress-step">
            <div>3</div>
            <div>Økonomisk</div>
          </div>
          <div className="progress-step">
            <div>4</div>
            <div>Signatur</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="campaign-form">
          {/* Personal Information */}
          <div className="form-section">
            <h3><FaUser /> Personlig Informasjon</h3>
            <div className="form-row">
              <div className="form-group required">
                <label htmlFor="first_name">Fornavn</label>
                <input
                  id="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  required
                  placeholder="Skriv fornavn"
                />
              </div>
              <div className="form-group required">
                <label htmlFor="last_name">Etternavn</label>
                <input
                  id="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  required
                  placeholder="Skriv etternavn"
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
                <label htmlFor="sms_phone_number">Mobilnummer</label>
                <input
                  id="sms_phone_number"
                  type="tel"
                  value={formData.sms_phone_number}
                  onChange={(e) => handleInputChange('sms_phone_number', e.target.value)}
                  required
                  placeholder="12345678"
                />
              </div>
            </div>

            <div className="form-row">
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
              <div className="form-group">
                <label htmlFor="kidnumber">KID Nummer</label>
                <input
                  id="kidnumber"
                  type="text"
                  value={formData.kidnumber}
                  onChange={(e) => handleInputChange('kidnumber', e.target.value)}
                  placeholder="Valgfritt KID nummer"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="form-section">
            <h3><FaMapMarkerAlt /> Adresse Informasjon</h3>
            <div className="form-group required">
              <label htmlFor="address_text">Adresse</label>
              <input
                id="address_text"
                type="text"
                value={formData.address_text}
                onChange={(e) => handleInputChange('address_text', e.target.value)}
                required
                placeholder="Gateadresse og postnummer"
              />
            </div>

            <div className="form-row">
              <div className="form-group required">
                <label htmlFor="postnummer">Postnummer</label>
                <input
                  id="postnummer"
                  type="text"
                  value={formData.postnummer}
                  onChange={(e) => handleInputChange('postnummer', e.target.value)}
                  required
                  placeholder="0000"
                />
              </div>
              <div className="form-group required">
                <label htmlFor="posted">Poststed</label>
                <input
                  id="posted"
                  type="text"
                  value={formData.posted}
                  onChange={(e) => handleInputChange('posted', e.target.value)}
                  required
                  placeholder="By/sted"
                />
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div className="form-section">
            <h3><FaCreditCard /> Økonomisk Informasjon</h3>
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

            <div className="form-group">
              <label htmlFor="personel_number">Personell Nummer</label>
              <input
                id="personel_number"
                type="text"
                value={formData.personel_number}
                onChange={(e) => handleInputChange('personel_number', e.target.value)}
                placeholder="Personell nummer"
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

          {/* Signature */}
          <div className="form-section">
            <h3><FaPen /> Underskrift</h3>
            <div className="signature-container">
              <canvas
                ref={canvasRef}
                className="signature-canvas"
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

          {/* Submit Button */}
          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="cancel-btn"
              disabled={isSubmitting}
            >
              Avbryt
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={isSubmitting || !hasSignature}
            >
              {isSubmitting ? 'Sender...' : 'Send Inn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CampaignFormPopup; 