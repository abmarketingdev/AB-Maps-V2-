/**
 * Frontend Integration Example for Filtered Sales API
 * This example shows how to integrate the filtered sales API with the manager dashboard
 */

class SalesDashboardAPI {
    constructor() {
        this.baseURL = '/api/dashboard/sales/filtered/';
        this.currentPage = 1;
        this.pageSize = 50;
        this.currentFilters = {};
    }

    /**
     * Get filtered sales data
     * @param {Object} options - Filter options
     * @param {string} options.campaignId - Campaign ID from localStorage
     * @param {string} options.startDate - Start date (YYYY-MM-DD)
     * @param {string} options.endDate - End date (YYYY-MM-DD)
     * @param {string} options.status - Status filter (comma-separated)
     * @param {string} options.search - Search query
     * @param {number} options.page - Page number
     * @param {number} options.pageSize - Items per page
     * @returns {Promise<Object>} API response
     */
    async getFilteredSales(options = {}) {
        const {
            campaignId,
            startDate,
            endDate,
            status,
            search,
            page = this.currentPage,
            pageSize = this.pageSize
        } = options;

        // Validate required parameters
        if (!campaignId) {
            throw new Error('campaign_id is required');
        }
        if (!startDate) {
            throw new Error('start_date is required');
        }
        if (!endDate) {
            throw new Error('end_date is required');
        }

        // Build query parameters
        const params = new URLSearchParams({
            campaign_id: campaignId,
            start_date: startDate,
            end_date: endDate,
            page: page.toString(),
            page_size: pageSize.toString()
        });

        if (status) {
            params.append('status', status);
        }
        if (search) {
            params.append('search', search);
        }

        try {
            const response = await fetch(`${this.baseURL}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    // Add authentication headers if needed
                    // 'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching filtered sales:', error);
            throw error;
        }
    }

    /**
     * Update the sales table with API data
     * @param {Object} data - API response data
     */
    updateSalesTable(data) {
        const tableBody = document.getElementById('sales-table-body');
        if (!tableBody) {
            console.error('Sales table body not found');
            return;
        }

        // Clear existing rows
        tableBody.innerHTML = '';

        // Add new rows
        data.results.forEach(sale => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sale.date}</td>
                <td>${sale.name}</td>
                <td>${sale.email}</td>
                <td>${sale.number}</td>
                <td>
                    <span class="status-badge status-${sale.status.toLowerCase()}">
                        ${sale.status}
                    </span>
                </td>
                <td>
                    <button class="action-btn" onclick="showActions('${sale.name}')">
                        <span>...</span>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Update pagination info
        this.updatePaginationInfo(data);
    }

    /**
     * Update pagination information
     * @param {Object} data - API response data
     */
    updatePaginationInfo(data) {
        const paginationInfo = document.getElementById('pagination-info');
        if (paginationInfo) {
            paginationInfo.textContent = `Viser ${data.results.length} av ${data.total_count} resultater`;
        }

        // Update pagination buttons
        this.updatePaginationButtons(data);
    }

    /**
     * Update pagination buttons
     * @param {Object} data - API response data
     */
    updatePaginationButtons(data) {
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (prevBtn) {
            prevBtn.disabled = data.page <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = data.page >= data.total_pages;
        }
    }

    /**
     * Load sales data with current filters
     */
    async loadSalesData() {
        try {
            // Show loading state
            this.showLoading(true);

            // Get campaign ID from localStorage
            const selectedCampaign = JSON.parse(localStorage.getItem('selectedCampaign'));
            const campaignId = selectedCampaign?.id;

            if (!campaignId) {
                throw new Error('No campaign selected. Please select a campaign first.');
            }

            // Get date range from UI
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;

            // Get status filter
            const showStarted = document.getElementById('show-started').checked;
            const statusFilter = showStarted ? 'pending,completed,callback' : 'completed';

            // Get search query
            const searchQuery = document.getElementById('search-input').value;

            // Fetch data
            const data = await this.getFilteredSales({
                campaignId,
                startDate,
                endDate,
                status: statusFilter,
                search: searchQuery,
                page: this.currentPage,
                pageSize: this.pageSize
            });

            // Update UI
            this.updateSalesTable(data);

        } catch (error) {
            console.error('Error loading sales data:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Show/hide loading state
     * @param {boolean} isLoading - Whether to show loading
     */
    showLoading(isLoading) {
        const loadingElement = document.getElementById('loading-indicator');
        const tableElement = document.getElementById('sales-table');

        if (loadingElement) {
            loadingElement.style.display = isLoading ? 'block' : 'none';
        }
        if (tableElement) {
            tableElement.style.opacity = isLoading ? '0.5' : '1';
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Hide error after 5 seconds
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Go to previous page
     */
    async previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            await this.loadSalesData();
        }
    }

    /**
     * Go to next page
     */
    async nextPage() {
        this.currentPage++;
        await this.loadSalesData();
    }

    /**
     * Apply filters and reload data
     */
    async applyFilters() {
        this.currentPage = 1; // Reset to first page
        await this.loadSalesData();
    }
}

// Initialize the API
const salesAPI = new SalesDashboardAPI();

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Load initial data
    salesAPI.loadSalesData();

    // Add event listeners for filters
    const filterElements = [
        'start-date', 'end-date', 'show-started', 'search-input'
    ];

    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => salesAPI.applyFilters());
            element.addEventListener('input', () => salesAPI.applyFilters());
        }
    });

    // Add event listeners for pagination
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => salesAPI.previousPage());
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => salesAPI.nextPage());
    }

    // Add event listener for campaign selection
    const campaignSelect = document.getElementById('campaign-select');
    if (campaignSelect) {
        campaignSelect.addEventListener('change', (e) => {
            const selectedCampaign = {
                id: e.target.value,
                name: e.target.options[e.target.selectedIndex].text
            };
            localStorage.setItem('selectedCampaign', JSON.stringify(selectedCampaign));
            salesAPI.applyFilters();
        });
    }
});

// Utility function for action buttons
function showActions(contactName) {
    console.log(`Show actions for: ${contactName}`);
    // Implement action menu logic here
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SalesDashboardAPI;
} 