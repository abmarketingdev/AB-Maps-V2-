"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth/AuthContext"
import { 
  fetchUploadedAddresses, 
  uploadCsvFile, 
  generateBatchId,
  uploadFile,
  getUploadProgress,
  downloadFailedAddresses,
  fetchUploadHistory,
  updateAddressText,
  cancelBatch,
  type UploadedAddress,
  type UploadProgressResponse,
  type BatchHistoryItem,
  type UpdateAddressTextResponse
} from "@/services/uploadedAddressesService"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, AlertCircle, Upload, CheckCircle, XCircle, Download, FileText, ChevronLeft, ChevronRight, Info, Package, Clock, Edit, Save, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { validateCsvFormat } from "@/utils/csvValidator"
import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

function UploadedAddressesContent() {
  const [addresses, setAddresses] = useState<UploadedAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()

  // New state for batch upload system
  const [downloadLoading, setDownloadLoading] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // New state for batch recovery
  const [ongoingBatches, setOngoingBatches] = useState<BatchHistoryItem[]>([])
  const [batchProgressIntervals, setBatchProgressIntervals] = useState<Map<string, NodeJS.Timeout>>(new Map())
  const [batchProgressData, setBatchProgressData] = useState<Map<string, UploadProgressResponse & { completed?: boolean }>>(new Map())
  const [batchInfo, setBatchInfo] = useState<Map<string, BatchHistoryItem>>(new Map())
  const [recoveryLoading, setRecoveryLoading] = useState(false)

  // New state for enhanced upload summary and accordion history
  const [uploadHistory, setUploadHistory] = useState<BatchHistoryItem[]>([])
  const [mostRecentUpload, setMostRecentUpload] = useState<BatchHistoryItem | null>(null)
  const [historicalUploads, setHistoricalUploads] = useState<BatchHistoryItem[]>([])
  const [accordionValue, setAccordionValue] = useState<string>("")

  // New state for inline address editing
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [editingAddressText, setEditingAddressText] = useState<string>("")
  const [updatingAddress, setUpdatingAddress] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  // State for tracking batch cancellation
  const [cancellingBatches, setCancellingBatches] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get campaign from localStorage
        const storedCampaign = localStorage.getItem('currentCampaign')
        if (!storedCampaign) {
          setError('Ingen kampanje valgt. Vennligst velg en kampanje først.')
          setLoading(false)
          return
        }

        let campaignData
        try {
          campaignData = JSON.parse(storedCampaign)
        } catch (e) {
          setError('Ugyldig kampanje-data i localStorage')
          setLoading(false)
          return
        }

        setSelectedCampaign(campaignData)

        // Get manager ID from user context
        const managerId = user?.user_info?.id || user?.user_id
        if (!managerId) {
          setError('Leder-ID ikke funnet. Vennligst logg inn igjen.')
          setLoading(false)
          return
        }

        const response = await fetchUploadedAddresses(campaignData.id, managerId, currentPage, pageSize)
        setAddresses(response.results)
        setTotalCount(response.count)
        setTotalPages(Math.ceil(response.count / pageSize))
      } catch (err) {
        console.error('Error loading uploaded addresses:', err)
        setError(err instanceof Error ? err.message : 'Kunne ikke laste opplastede adresser')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, currentPage, pageSize])

  // Auto-recovery of ongoing uploads
  useEffect(() => {
    const recoverOngoingUploads = async () => {
      if (!user) return;
      
      try {
        setRecoveryLoading(true)
        console.log('Checking for ongoing uploads...')
        
        // Step 1: Get user's upload history
        const historyResponse = await fetchUploadHistory()
        const allBatches = historyResponse.upload_history
        const processingBatches = allBatches.filter(
          batch => batch.status === 'processing'
        )
        const completedBatches = allBatches.filter(
          batch => batch.status === 'completed' || batch.status === 'finished'
        )
        
        console.log('Found all batches:', allBatches.length)
        console.log('Found processing batches:', processingBatches.length)
        console.log('Found completed batches:', completedBatches.length)
        
        setOngoingBatches(processingBatches)
        
        // Store batch information for ALL batches (processing and completed)
        setBatchInfo(prev => {
          const newMap = new Map(prev)
          allBatches.forEach(batch => {
            newMap.set(batch.batch_id, batch)
          })
          return newMap
        })

        // Organize upload history for enhanced UI
        organizeUploadHistory(allBatches)
        
        // For completed batches, get their final progress and mark as completed
        for (const batch of completedBatches) {
          try {
            console.log('Getting final progress for completed batch:', batch.batch_id)
            const progressData = await getUploadProgress(batch.batch_id)
            
            // Mark as completed
            setBatchProgressData(prev => {
              const newMap = new Map(prev)
              newMap.set(batch.batch_id, { ...progressData, progress_percentage: 100, completed: true })
              console.log('Marked existing completed batch:', batch.batch_id)
              return newMap
            })
            
            // Ensure batch info is stored
            setBatchInfo(prev => {
              const newMap = new Map(prev)
              if (!newMap.has(batch.batch_id)) {
                newMap.set(batch.batch_id, batch)
                console.log('Stored batch info for completed batch:', batch.batch_id)
              }
              return newMap
            })
          } catch (error) {
            console.error('Error getting progress for completed batch', batch.batch_id, ':', error)
          }
        }
        
        // Step 2: For each processing batch, get real-time progress and start tracking
        for (const batch of processingBatches) {
          try {
            console.log('Processing batch for recovery:', batch.batch_id)
            
            // Get current progress from upload-progress endpoint
            const progressData = await getUploadProgress(batch.batch_id)
            console.log('Initial progress for batch', batch.batch_id, ':', progressData)
            
            // Set the progress data
            setBatchProgressData(prev => {
              const newMap = new Map(prev)
              newMap.set(batch.batch_id, progressData)
              return newMap
            })
            
            // Start progress tracking
            console.log('Starting progress tracking for recovered batch:', batch.batch_id)
            startBatchProgressTracking(batch.batch_id)
            
            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (error) {
            console.error('Error getting initial progress for batch', batch.batch_id, ':', error)
          }
        }
        
      } catch (error) {
        console.error('Error recovering ongoing uploads:', error)
        // Don't show error to user for recovery failures
      } finally {
        setRecoveryLoading(false)
      }
    }

    recoverOngoingUploads()
  }, [user])

  const organizeUploadHistory = (allBatches: BatchHistoryItem[]) => {
    // Sort by created_at descending (most recent first)
    const sortedBatches = [...allBatches].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    setUploadHistory(sortedBatches)
    
    // Set most recent upload (first in sorted array)
    if (sortedBatches.length > 0) {
      setMostRecentUpload(sortedBatches[0])
      // Set historical uploads (all except the first)
      setHistoricalUploads(sortedBatches.slice(1))
    } else {
      setMostRecentUpload(null)
      setHistoricalUploads([])
    }
  }

  // Cleanup all intervals on unmount
  useEffect(() => {
    return () => {
      // Cleanup all batch progress intervals
      batchProgressIntervals.forEach(interval => {
        clearInterval(interval)
      })
    }
  }, [batchProgressIntervals])

  const handleRefresh = async () => {
    try {
      setLoading(true)
      setError(null)

      const storedCampaign = localStorage.getItem('currentCampaign')
      if (!storedCampaign) {
        setError('Ingen kampanje valgt')
        return
      }

      const campaignData = JSON.parse(storedCampaign)
      const managerId = user?.user_info?.id || user?.user_id

      if (!managerId) {
        setError('Leder-ID ikke funnet')
        return
      }

      const response = await fetchUploadedAddresses(campaignData.id, managerId, currentPage, pageSize)
      setAddresses(response.results)
      setTotalCount(response.count)
      setTotalPages(Math.ceil(response.count / pageSize))
    } catch (err) {
      console.error('Error refreshing addresses:', err)
      setError(err instanceof Error ? err.message : 'Kunne ikke oppdatere adresser')
    } finally {
      setLoading(false)
    }
  }

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  const handleFirstPage = () => handlePageChange(1)
  const handleLastPage = () => handlePageChange(totalPages)
  const handleNextPage = () => handlePageChange(currentPage + 1)
  const handlePrevPage = () => handlePageChange(currentPage - 1)

  // Start progress tracking for a specific batch
  const startBatchProgressTracking = (batchId: string) => {
    console.log('Starting progress tracking for batch:', batchId)
    
    // Check if already tracking this batch
    if (batchProgressIntervals.has(batchId)) {
      console.log(`Already tracking batch ${batchId}, skipping`)
      return
    }
    
    // Check if already completed
    const existingProgress = batchProgressData.get(batchId)
    if (existingProgress?.completed) {
      console.log(`Batch ${batchId} is already completed, skipping tracking`)
      return
    }
    
    const interval = setInterval(async () => {
      try {
        console.log(`Polling progress for batch ${batchId} at ${new Date().toLocaleTimeString()}`)
        const progress = await getUploadProgress(batchId)
        console.log('Progress update for batch', batchId, ':', progress)
        
        // Update batch progress data with latest progress
        setBatchProgressData(prev => {
          const newMap = new Map(prev)
          newMap.set(batchId, progress)
          console.log(`Updated progress data for batch ${batchId}:`, progress)
          return newMap
        })
        
        // Stop tracking when complete (robust completion conditions)
        const processedTotal = (progress.geocoded_addresses || 0) + (progress.failed_addresses || 0)
        const isCompletedStatus = progress.status === 'completed' || progress.status === 'finished'
        const isProcessedAll = processedTotal >= (progress.total_addresses || 0)
        const isHundred = (progress.progress_percentage || 0) >= 100

        if (isCompletedStatus || isProcessedAll || isHundred) {
          console.log('Batch completed:', batchId)
          clearInterval(interval)
          
          // Remove from ongoing batches
          setOngoingBatches(prev => prev.filter(batch => batch.batch_id !== batchId))
          
          // Remove interval from tracking
          setBatchProgressIntervals(prev => {
            const newMap = new Map(prev)
            newMap.delete(batchId)
            return newMap
          })
          
          // Keep the progress data for completion display
          setBatchProgressData(prev => {
            const newMap = new Map(prev)
            newMap.set(batchId, { ...progress, progress_percentage: 100, completed: true })
            console.log('Marked batch as completed:', batchId, 'Total completed batches:', newMap.size)
            return newMap
          })
          
          // Ensure batch info is preserved for completion display
          setBatchInfo(prev => {
            const newMap = new Map(prev)
            if (!newMap.has(batchId)) {
              // If batch info is missing, create a fallback
              const fallbackBatch: BatchHistoryItem = {
                batch_id: batchId,
                campaign_name: 'Unknown Campaign',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                file_name: '',
                status: 'completed',
                total_addresses: 0,
                processed_addresses: 0,
                geocoded_addresses: 0,
                failed_addresses: 0,
                progress_percentage: 100
              }
              newMap.set(batchId, fallbackBatch)
              console.log('Created fallback batch info for completed batch:', batchId)
            }
            return newMap
          })
          
          console.log('Batch info for completed batch:', batchId, ':', batchInfo.get(batchId))
          
          // Refresh upload history to reflect completion
          const allBatches = Array.from(batchInfo.values())
          organizeUploadHistory(allBatches)
          
          // Refresh addresses list
          await handleRefresh()
        }
      } catch (error) {
        console.error('Error tracking batch progress:', error)
        clearInterval(interval)
        
        // Remove from tracking on error
        setBatchProgressIntervals(prev => {
          const newMap = new Map(prev)
          newMap.delete(batchId)
          return newMap
        })
      }
    }, 5000) // Poll every 5 seconds

    // Store interval for cleanup
    setBatchProgressIntervals(prev => {
      const newMap = new Map(prev)
      newMap.set(batchId, interval)
      console.log(`Progress tracking started for batch ${batchId}, will poll every 5 seconds. Total tracking: ${newMap.size} batches`)
      return newMap
    })
  }

  // Start progress tracking for new upload (legacy - now using startBatchProgressTracking)
  const startProgressTracking = (batchId: string) => {
    console.log('Legacy startProgressTracking called, redirecting to startBatchProgressTracking')
    startBatchProgressTracking(batchId)
  }

  // Cancel progress tracking and backend batch processing
  const cancelProgressTracking = async (batchId: string) => {
    try {
      // Set loading state
      setCancellingBatches(prev => new Set(prev).add(batchId))

      // Stop frontend progress polling
      const interval = batchProgressIntervals.get(batchId)
      if (interval) {
        clearInterval(interval)
        setBatchProgressIntervals(prev => {
          const newMap = new Map(prev)
          newMap.delete(batchId)
          return newMap
        })
      }

      // Call backend API to cancel the batch
      await cancelBatch(batchId)

      // Update batch status to cancelled
      setBatchProgressData(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(batchId)
        if (existing) {
          newMap.set(batchId, {
            ...existing,
            status: 'cancelled',
            completed: true
          })
        }
        return newMap
      })

      // Update batch info
      setBatchInfo(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(batchId)
        if (existing) {
          newMap.set(batchId, {
            ...existing,
            status: 'cancelled'
          })
        }
        return newMap
      })

      // Update ongoing batches - mark as cancelled
      setOngoingBatches(prev => prev.map(batch => 
        batch.batch_id === batchId 
          ? { ...batch, status: 'cancelled' }
          : batch
      ))

      // Reset uploading state if this was the active upload
      setUploading(false)

      // Clear any upload error/success messages
      setUploadError(null)
      setUploadSuccess(`Batch ${batchId} ble avbrutt`)

      // Refresh upload history to reflect cancelled status
      const updatedBatchInfo = new Map(batchInfo)
      const cancelledBatch = updatedBatchInfo.get(batchId)
      if (cancelledBatch) {
        updatedBatchInfo.set(batchId, { ...cancelledBatch, status: 'cancelled' })
        setBatchInfo(updatedBatchInfo)
        const allBatches = Array.from(updatedBatchInfo.values())
        organizeUploadHistory(allBatches)
      }
    } catch (error) {
      console.error('Error canceling batch:', error)
      setUploadError(error instanceof Error ? error.message : 'Kunne ikke avbryte batch')
      // Still reset uploading state even if API call fails
      setUploading(false)
    } finally {
      // Remove loading state
      setCancellingBatches(prev => {
        const newSet = new Set(prev)
        newSet.delete(batchId)
        return newSet
      })
    }
  }

  // Handle file upload with new batch system
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Clear previous messages
    setUploadError(null)
    setUploadSuccess(null)

    try {
      // Validate CSV format
      const validation = await validateCsvFormat(file)
      if (!validation.isValid) {
        setUploadError(validation.error || 'Ugyldig CSV-format')
        return
      }

      // Get campaign ID
      const storedCampaign = localStorage.getItem('currentCampaign')
      if (!storedCampaign) {
        setUploadError('Ingen kampanje valgt. Vennligst velg en kampanje først.')
        return
      }

      let campaignData
      try {
        campaignData = JSON.parse(storedCampaign)
      } catch (e) {
        setUploadError('Ugyldig kampanje-data i localStorage')
        return
      }

      // Step 1: Generate batch ID
      setUploading(true)
      const batchResponse = await generateBatchId()
      const newBatchId = batchResponse.batch_id

      // Step 2: Upload file with batch ID
      const uploadResponse = await uploadFile(file, campaignData.id, newBatchId)
      
      // Step 3: Add to ongoing batches and start progress tracking
      const newBatch: BatchHistoryItem = {
        batch_id: newBatchId,
        campaign_name: campaignData.name,
        status: 'processing',
        total_addresses: uploadResponse.total_addresses || 0,
        processed_addresses: 0,
        geocoded_addresses: 0,
        failed_addresses: 0,
        progress_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        file_name: file.name
      }
      
      // Add to ongoing batches
      setOngoingBatches(prev => [...prev, newBatch])
      
      // Store batch info
      setBatchInfo(prev => {
        const newMap = new Map(prev)
        newMap.set(newBatchId, newBatch)
        return newMap
      })
      
      // Start progress tracking
      startBatchProgressTracking(newBatchId)
      
      // Update upload history to include the new upload
      const updatedBatchInfo = new Map(batchInfo)
      updatedBatchInfo.set(newBatchId, newBatch)
      setBatchInfo(updatedBatchInfo)
      
      // Refresh upload history to show the new upload as most recent
      const allBatches = Array.from(updatedBatchInfo.values())
      organizeUploadHistory(allBatches)
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Error uploading CSV:', err)
      setUploadError(err instanceof Error ? err.message : 'Kunne ikke laste opp CSV-filen')
    } finally {
      setUploading(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // Handle download of failed addresses
  const handleDownloadFailed = async () => {
    try {
      setDownloadLoading(true)
      
      const storedCampaign = localStorage.getItem('currentCampaign')
      
      if (!storedCampaign) {
        setUploadError('Mangler kampanje-data')
        return
      }

      const campaignData = JSON.parse(storedCampaign)
      const managerId = user?.user_info?.id || user?.user_id
      
      if (!managerId) {
        setUploadError('Leder-ID ikke funnet. Vennligst logg inn igjen.')
        return
      }
      
      const blob = await downloadFailedAddresses(campaignData.id, managerId)
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `failed-addresses-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
    } catch (error) {
      console.error('Error downloading failed addresses:', error)
      setUploadError('Kunne ikke laste ned feilede adresser')
    } finally {
      setDownloadLoading(false)
    }
  }

  // Handle download of failed addresses for specific batch
  const handleDownloadFailedForBatch = async (batchId: string) => {
    try {
      setDownloadLoading(true)
      
      const storedCampaign = localStorage.getItem('currentCampaign')
      
      if (!storedCampaign) {
        setUploadError('Mangler kampanje-data')
        return
      }

      const campaignData = JSON.parse(storedCampaign)
      const managerId = user?.user_info?.id || user?.user_id
      
      if (!managerId) {
        setUploadError('Leder-ID ikke funnet. Vennligst logg inn igjen.')
        return
      }
      
      const blob = await downloadFailedAddresses(campaignData.id, managerId)
      
      // Create download link with batch ID in filename
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `failed-addresses-batch-${batchId}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
    } catch (error) {
      console.error('Error downloading failed addresses for batch:', error)
      setUploadError('Kunne ikke laste ned feilede adresser')
    } finally {
      setDownloadLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Inline editing functions
  const handleEditAddress = (address: UploadedAddress) => {
    setEditingAddressId(address.id)
    setEditingAddressText(address.address_text)
    setEditSuccess(null)
    setEditError(null)
  }

  const handleCancelEdit = () => {
    setEditingAddressId(null)
    setEditingAddressText("")
    setEditSuccess(null)
    setEditError(null)
  }

  const handleSaveAddress = async (addressId: string) => {
    if (!editingAddressText.trim()) {
      setEditError("Adressetekst kan ikke være tom")
      return
    }

    try {
      setUpdatingAddress(addressId)
      setEditSuccess(null)
      setEditError(null)

      const response: UpdateAddressTextResponse = await updateAddressText(addressId, editingAddressText.trim())

      if (response.geocoding_status === 'success') {
        setEditSuccess(`🟢 Adresse oppdatert og geokodet vellykket! Koordinater: ${response.latitude?.toFixed(4)}, ${response.longitude?.toFixed(4)}`)
        
        // Update the address in the local state
        setAddresses(prev => prev.map(addr => 
          addr.id === addressId 
            ? {
                ...addr,
                address_text: response.new_address_text,
                is_geocoded: true,
                latitude: response.latitude!,
                longitude: response.longitude!,
                geocoded_at: response.geocoded_at!
              }
            : addr
        ))
        
        // Exit edit mode
        setEditingAddressId(null)
        setEditingAddressText("")
      } else {
        setEditError(`⚠️ Geokodering feilet: ${response.error || 'Ukjent feil'}. Vennligst sjekk formateringen og prøv igjen.`)
        // Keep the input field visible for retry
      }
    } catch (error) {
      console.error('Error updating address:', error)
      setEditError(error instanceof Error ? error.message : 'Kunne ikke oppdatere adresse')
    } finally {
      setUpdatingAddress(null)
    }
  }

  if (loading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Laster opplastede adresser...</span>
          </div>
        </div>
      </ClientLayout>
    )
  }

  return (
    <ClientLayout>
      <TooltipProvider>
        <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Legg til adresse</h1>
            <p className="text-muted-foreground">
              Last opp CSV-filer med adresser for kampanje: {selectedCampaign?.name}
            </p>
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Oppdater
            </Button>
            <Button onClick={handleUploadClick} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" />
              Last opp CSV
            </Button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Upload Error Alert */}
        {uploadError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        {/* Upload Success Alert */}
        {uploadSuccess && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{uploadSuccess}</AlertDescription>
          </Alert>
        )}

        {/* Edit Success Alert */}
        {editSuccess && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{editSuccess}</AlertDescription>
          </Alert>
        )}

        {/* Edit Error Alert */}
        {editError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{editError}</AlertDescription>
          </Alert>
        )}

        {/* Enhanced Upload Summary & Accordion History UI */}
        
        {/* Section 1: Most Recent Upload */}
        {mostRecentUpload && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="h-5 w-5 text-blue-600" />
                <span>📦 Nylig opplasting - {mostRecentUpload.campaign_name}</span>
                {mostRecentUpload.file_name && (
                  <span className="text-sm text-gray-500">({mostRecentUpload.file_name})</span>
                )}
                {mostRecentUpload.status === 'processing' && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    🟡 Pågår
                  </Badge>
                )}
                {mostRecentUpload.status === 'cancelled' && (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                    ⚫ Avbrutt
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mostRecentUpload.status === 'cancelled' ? (
                // Show cancelled message
                <div className="text-center py-4">
                  <Alert className="bg-gray-100 border-gray-300">
                    <AlertCircle className="h-4 w-4 text-gray-600" />
                    <AlertDescription className="text-gray-700">
                      Denne opplastingen ble avbrutt. Behandlede adresser er ikke lagret.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : mostRecentUpload.status === 'processing' ? (
                // Show progress for processing uploads
                (() => {
                  const progressData = batchProgressData.get(mostRecentUpload.batch_id)
                  if (!progressData) return null
                  
                  return (
                    <>
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          key={`progress-${mostRecentUpload.batch_id}-${progressData.progress_percentage}`}
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${progressData.progress_percentage}%` }}
                        ></div>
                      </div>

                      {/* Progress Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-blue-600">Fremdrift</div>
                          <div>{progressData.progress_percentage}%</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-gray-600">Behandlet</div>
                          <div>{progressData.processed_addresses} / {progressData.total_addresses}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-green-600">Geokodet</div>
                          <div>{progressData.geocoded_addresses}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-red-600">Feilet</div>
                          <div>{progressData.failed_addresses}</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          Startet: {formatDate(mostRecentUpload.created_at)} | Live oppdateringer hvert 5. sekund
                        </div>
                        <Button 
                          onClick={() => cancelProgressTracking(mostRecentUpload.batch_id)} 
                          variant="outline" 
                          size="sm"
                          disabled={cancellingBatches.has(mostRecentUpload.batch_id) || mostRecentUpload.status === 'cancelled'}
                        >
                          {cancellingBatches.has(mostRecentUpload.batch_id) ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Avbryter...
                            </>
                          ) : mostRecentUpload.status === 'cancelled' ? (
                            'Avbrutt'
                          ) : (
                            'Avbryt'
                          )}
                        </Button>
                      </div>
                    </>
                  )
                })()
              ) : (
                // Show completion summary for completed uploads
                (() => {
                  const progressData = batchProgressData.get(mostRecentUpload.batch_id)
                  if (!progressData) return null
                  
                  return (
                    <>
                      {/* Progress Bar - Full */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: '100%' }}
                        ></div>
                      </div>

                      {/* Completion Summary */}
                      <div className="text-center mb-4">
                        <p className="text-sm text-gray-600 mb-2">
                          <strong>Oppsummering:</strong> Totalt: {progressData.total_addresses} | 
                          Geokodet: {progressData.geocoded_addresses} | 
                          Feilet: {progressData.failed_addresses} |
                          Hoppet over: {Math.max(0, (progressData.total_addresses || 0) - (progressData.geocoded_addresses || 0) - (progressData.failed_addresses || 0))}
                        </p>
                      </div>

                      {/* Download Failed Addresses Button */}
                      {progressData.failed_addresses > 0 && (
                        <div className="flex justify-center">
                          <Button 
                            onClick={() => handleDownloadFailedForBatch(mostRecentUpload.batch_id)} 
                            disabled={downloadLoading}
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            {downloadLoading ? 'Laster ned...' : '📥 Last ned feilede adresser'}
                          </Button>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 text-center">
                        Startet: {formatDate(mostRecentUpload.created_at)} | Fullført: {new Date().toLocaleTimeString()}
                      </div>
                    </>
                  )
                })()
              )}
            </CardContent>
          </Card>
        )}

        {/* Section 2: Accordion for Historical Uploads */}
        {historicalUploads.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>📌 Opplastingshistorikk</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion 
                type="single" 
                collapsible 
                value={accordionValue}
                onValueChange={setAccordionValue}
                className="space-y-2"
              >
                {historicalUploads.map((batch) => {
                  const progressData = batchProgressData.get(batch.batch_id)
                  const isProcessing = batch.status === 'processing'
                  
                  return (
                    <AccordionItem key={batch.batch_id} value={batch.batch_id} className="border rounded-lg">
                      <AccordionTrigger className="px-4 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center space-x-3">
                            <span className="font-medium">📌 {batch.campaign_name}</span>
                            <span className="text-sm text-gray-500">
                              | Totalt: {batch.total_addresses} | Feilet: {batch.failed_addresses} | Opplastet: {formatDate(batch.created_at)}
                            </span>
                          </div>
                          <Badge 
                            variant={isProcessing ? "secondary" : "default"}
                            className={isProcessing ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}
                          >
                            {isProcessing ? "🟡 Pågår" : "✅ Fullført"}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
                           {/* Summary */}
                          <div className="text-sm text-gray-600">
                            <strong>Oppsummering:</strong> Totalt: {batch.total_addresses} | 
                             Geokodet: {batch.geocoded_addresses} | 
                             Feilet: {batch.failed_addresses} |
                             Hoppet over: {Math.max(0, (batch.total_addresses || 0) - (batch.geocoded_addresses || 0) - (batch.failed_addresses || 0))}
                            {batch.file_name && (
                              <span className="ml-2 text-gray-500">| Fil: {batch.file_name}</span>
                            )}
                          </div>

                          {/* Progress Bar for processing uploads */}
                          {isProcessing && progressData && (
                            <div className="space-y-2">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${progressData.progress_percentage}%` }}
                                ></div>
                              </div>
                              <div className="text-xs text-gray-500">
                                Fremdrift: {progressData.progress_percentage}% | 
                                Behandlet: {progressData.processed_addresses} / {progressData.total_addresses}
                              </div>
                            </div>
                          )}

                          {/* Download Failed Addresses Button */}
                          {batch.failed_addresses > 0 && (
                            <div className="flex justify-center">
                              <Button 
                                onClick={() => handleDownloadFailedForBatch(batch.batch_id)} 
                                disabled={downloadLoading}
                                variant="outline"
                                size="sm"
                                className="border-red-200 text-red-700 hover:bg-red-50"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                {downloadLoading ? 'Laster ned...' : '📥 Last ned feilede adresser'}
                              </Button>
                            </div>
                          )}

                          <div className="text-xs text-gray-500">
                            Startet: {formatDate(batch.created_at)} | 
                            {batch.status === 'completed' || batch.status === 'finished' ? 
                              `Fullført: ${new Date().toLocaleTimeString()}` : 
                              'Status: Behandler'
                            }
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* Upload Progress Section for new uploads - REMOVED - Now using unified batch tracking */}

        {/* CSV Format Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>CSV Formatkrav</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-2">
              CSV-filen din må inneholde følgende kolonner:
            </p>
            <div className="bg-gray-50 p-3 rounded text-sm font-mono">
              gate/vei 2, postnummer, poststed
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Eksempel: "Storgata 1, 0001, Oslo"
            </p>
          </CardContent>
        </Card>

        {/* Addresses Table */}
        <Card>
          <CardHeader>
            <CardTitle>Opplastede adresser ({totalCount})</CardTitle>
            <CardDescription>
              Alle adresser lastet opp for denne kampanjen - Side {currentPage} av {totalPages}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {addresses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Ingen adresser lastet opp ennå. Last opp en CSV-fil for å komme i gang.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Adresse</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Lagt til</TableHead>
                        <TableHead>Geokodet</TableHead>
                        <TableHead>Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {addresses.map((address) => (
                        <TableRow key={address.id}>
                          <TableCell className="font-medium">
                            {editingAddressId === address.id ? (
                              <div className="flex items-center space-x-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Input
                                      value={editingAddressText}
                                      onChange={(e) => setEditingAddressText(e.target.value)}
                                      className="flex-1"
                                      placeholder="Skriv inn adressetekst..."
                                      autoFocus
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Format: "gate/vei 2, Postnummer, Poststed, Norway"</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Eksempel: "Storgata 1, 0001, Oslo, Norway"
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            ) : (
                              address.address_text
                            )}
                          </TableCell>
                          <TableCell>
                            {address.is_geocoded ? (
                              <span className="flex items-center text-green-600">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Geokodet
                              </span>
                            ) : (
                              <span className="flex items-center text-yellow-600">
                                <AlertCircle className="h-4 w-4 mr-1" />
                                Venter
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(address.added_at)}</TableCell>
                          <TableCell>
                            {address.is_geocoded ? formatDate(address.geocoded_at) : '-'}
                          </TableCell>
                          <TableCell>
                            {editingAddressId === address.id ? (
                              <div className="flex items-center space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSaveAddress(address.id)}
                                  disabled={updatingAddress === address.id}
                                  className="text-green-600 hover:text-green-700"
                                  title="Lagre endringer"
                                >
                                  {updatingAddress === address.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Save className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                  disabled={updatingAddress === address.id}
                                  className="text-red-600 hover:text-red-700"
                                  title="Avbryt redigering"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              !address.is_geocoded && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleEditAddress(address)}
                                      className="text-blue-600 hover:text-blue-700"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Rediger adressetekst og prøv geokodering på nytt</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Format: "gate/vei 2, Postnummer, Poststed, Norway"
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Viser {((currentPage - 1) * pageSize) + 1} til {Math.min(currentPage * pageSize, totalCount)} av {totalCount} adresser
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleFirstPage}
                        disabled={currentPage === 1}
                      >
                        Første
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Forrige
                      </Button>
                      <span className="text-sm font-medium">
                        Side {currentPage} av {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                      >
                        Neste
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLastPage}
                        disabled={currentPage === totalPages}
                      >
                        Siste
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </TooltipProvider>
    </ClientLayout>
  )
}

export default function UploadedAddressesPage() {
  return (
    <ProtectedRoute>
      <UploadedAddressesContent />
    </ProtectedRoute>
  )
} 