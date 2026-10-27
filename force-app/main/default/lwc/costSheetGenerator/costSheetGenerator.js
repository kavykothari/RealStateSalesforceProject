import { LightningElement, api, wire } from 'lwc';

import { CurrentPageReference } from 'lightning/navigation';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import searchCustomers
    from '@salesforce/apex/AarvyaEstates_CostSheetController.searchCustomers';

import getOpportunityDetails
    from '@salesforce/apex/AarvyaEstates_CostSheetController.getOpportunityDetails';

import generateCostSheet
    from '@salesforce/apex/AarvyaEstates_CostSheetController.generateCostSheet';
import createSiteVisitFeedback
    from '@salesforce/apex/AarvyaEstates_CostSheetController.createSiteVisitFeedback';

import validateDiscountCoupon
    from '@salesforce/apex/AarvyaEstates_CostSheetController.validateDiscountCoupon';

export default class CostSheetGenerator extends LightningElement {

    // ============================================================
    // RECORD CONTEXT
    // ============================================================

    @api recordId;


    // ============================================================
    // OPPORTUNITY
    // ============================================================

    opportunityId = null;

    selectedOpportunity = null;

    urlOpportunityMode = false;
    // ============================================================
// CUSTOMER FEEDBACK
// ============================================================

showFeedbackForm = false;

feedbackText = '';

isSubmittingFeedback = false;


    // ============================================================
    // SEARCH FIELDS
    // ============================================================

    firstName = '';
    lastName = '';
    phone = '';
    email = '';


    // ============================================================
    // SEARCH RESULTS
    // ============================================================

    searchResults = [];


    // ============================================================
    // LOADING
    // ============================================================

    isLoading = false;
    isSearching = false;
    isGenerating = false;
couponCode = '';
appliedCouponCode = '';
appliedCouponMessage = '';
couponDiscount = 0;
originalTotal = 0;
discountedTotal = 0;
isCouponApplied = false;
isApplyingCoupon = false;

handleCouponCodeChange(event) {
    this.couponCode = event.target.value;
}

get isRemoveCouponDisabled() {
    return !this.isCouponApplied;
}

async handleApplyCoupon() {
    if (!this.recordId) {
        this.showToast('Error', 'Unit record ID is missing.', 'error');
        return;
    }

    if (!this.couponCode || !this.couponCode.trim()) {
        this.showToast('Enter Coupon', 'Please enter a discount code.', 'warning');
        return;
    }

    this.isApplyingCoupon = true;

    try {
        const result = await validateDiscountCoupon({
            unitId: this.recordId,
            couponCode: this.couponCode.trim()
        });

        if (!result.isValid) {
            this.clearCouponValues();
            this.showToast('Invalid Coupon', result.message, 'error');
            return;
        }

        this.isCouponApplied = true;
        this.appliedCouponCode = result.couponCode;
        this.couponDiscount = result.discountValue;
        this.originalTotal = result.originalTotal;
        this.discountedTotal = result.discountedTotal;
        this.appliedCouponMessage =
            `Coupon ${result.couponCode} applied successfully.`;

        this.showToast('Coupon Applied', result.message, 'success');
    } catch (error) {
        this.clearCouponValues();
        this.showToast(
            'Coupon Validation Failed',
            this.reduceError(error),
            'error'
        );
    } finally {
        this.isApplyingCoupon = false;
    }
}

handleRemoveCoupon() {
    this.clearCouponValues();
    this.showToast(
        'Coupon Removed',
        'The original cost sheet pricing has been restored.',
        'success'
    );
}

clearCouponValues() {
    this.couponCode = '';
    this.appliedCouponCode = '';
    this.appliedCouponMessage = '';
    this.couponDiscount = 0;
    this.originalTotal = 0;
    this.discountedTotal = 0;
    this.isCouponApplied = false;
}

get formattedOriginalTotal() {
    return this.formatCurrency(this.originalTotal);
}

get formattedDiscountValue() {
    return this.formatCurrency(this.couponDiscount);
}

get formattedDiscountedTotal() {
    return this.formatCurrency(this.discountedTotal);
}

formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(Number(value || 0));
}

    // ============================================================
    // READ URL PARAMETER
    //
    // Example:
    //
    // ?c__opportunityId=006XXXXXXXXXXXX
    // ============================================================

    @wire(CurrentPageReference)
    handlePageReference(pageRef) {

        if (!pageRef) {
            return;
        }

        const urlOpportunityId =
            pageRef.state?.c__opportunityId;

        // --------------------------------------------------------
        // Opportunity ID found in URL
        // --------------------------------------------------------

        if (urlOpportunityId) {

            if (
                urlOpportunityId !== this.opportunityId ||
                !this.selectedOpportunity
            ) {

                this.urlOpportunityMode = true;

                this.opportunityId =
                    urlOpportunityId;

                this.loadOpportunity();
            }

            return;
        }

        // --------------------------------------------------------
        // No Opportunity ID
        // --------------------------------------------------------

        this.urlOpportunityMode = false;

        this.opportunityId = null;

        this.selectedOpportunity = null;
    }


    // ============================================================
    // LOAD OPPORTUNITY
    // ============================================================

    async loadOpportunity() {

        if (!this.opportunityId) {
            return;
        }

        this.isLoading = true;

        try {

            const result =
                await getOpportunityDetails({
                    opportunityId: this.opportunityId
                });

            if (!result) {

                this.showToast(
                    'Error',
                    'No Opportunity details found.',
                    'error'
                );

                this.selectedOpportunity = null;

                return;
            }

            this.selectedOpportunity =
                result;

        } catch (error) {

            this.selectedOpportunity =
                null;

            this.showToast(
                'Error',
                this.reduceError(error),
                'error'
            );

        } finally {

            this.isLoading = false;
        }
    }


    // ============================================================
    // INPUT CHANGE
    // ============================================================

    handleInputChange(event) {

        const field =
            event.target.dataset.field;

        this[field] =
            event.target.value;
    }


    // ============================================================
    // SEARCH
    // ============================================================

    async handleSearch() {

        if (
            !this.firstName &&
            !this.lastName &&
            !this.phone &&
            !this.email
        ) {

            this.showToast(
                'Validation',
                'Please enter at least one search field.',
                'warning'
            );

            return;
        }

        this.isSearching = true;

        try {

            const result =
                await searchCustomers({
                    firstName: this.firstName,
                    lastName: this.lastName,
                    phone: this.phone,
                    email: this.email
                });

            this.searchResults =
                result || [];

            if (!this.searchResults.length) {

                this.showToast(
                    'No Results',
                    'No matching customer or Opportunity found.',
                    'warning'
                );
            }

        } catch (error) {

            this.searchResults = [];

            this.showToast(
                'Error',
                this.reduceError(error),
                'error'
            );

        } finally {

            this.isSearching = false;
        }
    }


    // ============================================================
    // SELECT OPPORTUNITY
    // ============================================================

    async handleOpportunitySelect(event) {

        const selectedOpportunityId =
            event.currentTarget.dataset.id;

        if (!selectedOpportunityId) {
            return;
        }

        this.opportunityId =
            selectedOpportunityId;

        this.urlOpportunityMode = false;

        await this.loadOpportunity();
    }


    // ============================================================
    // SEARCH AGAIN
    // ============================================================

    handleBackToSearch() {

        this.selectedOpportunity =
            null;

        this.opportunityId =
            null;

        this.searchResults =
            [];

        this.urlOpportunityMode =
            false;
    }


    // ============================================================
    // GENERATE COST SHEET
    // ============================================================

    async handleGenerate() {

        if (!this.recordId) {

            this.showToast(
                'Error',
                'Unit record ID is missing.',
                'error'
            );

            return;
        }

        if (!this.opportunityId) {

            this.showToast(
                'Error',
                'Opportunity is missing.',
                'error'
            );

            return;
        }

        if (!this.selectedOpportunity?.contactId) {

            this.showToast(
                'Error',
                'No Contact is associated with this Opportunity.',
                'error'
            );

            return;
        }

        // --------------------------------------------------------
        // Open blank tab immediately.
        // This prevents popup blocker.
        // --------------------------------------------------------

        const pdfWindow =
            window.open('', '_blank');

        if (!pdfWindow) {

            this.showToast(
                'Error',
                'Please allow pop-ups to generate the Cost Sheet.',
                'error'
            );

            return;
        }

        this.isGenerating = true;

        try {

            // ----------------------------------------------------
            // Generate and save Salesforce File
            // ----------------------------------------------------

            const result = await generateCostSheet({
                unitId: this.recordId,
                contactId: this.selectedOpportunity.contactId,
                opportunityId: this.opportunityId,
                couponCode: this.isCouponApplied ? this.appliedCouponCode : null
            });

            if (!result?.contentVersionId) {

                throw new Error(
                    'Cost Sheet file was not generated.'
                );
            }

            // ----------------------------------------------------
            // Open PDF
            // ----------------------------------------------------

            let pdfUrl =
                    `/apex/AarvyaEstates_CostSheetPDF` +
                    `?unitId=${encodeURIComponent(this.recordId)}` +
                    `&opportunityId=${encodeURIComponent(this.opportunityId)}`;

                if (this.isCouponApplied && this.appliedCouponCode) {
                    pdfUrl += `&couponCode=${encodeURIComponent(this.appliedCouponCode)}`;
                }

                pdfWindow.location.href = pdfUrl;

            // ----------------------------------------------------
            // Download Salesforce File
            // ----------------------------------------------------

            const downloadUrl =
                `/sfc/servlet.shepherd/version/download/` +
                `${result.contentVersionId}`;

            const downloadWindow =
                window.open(
                    downloadUrl,
                    '_blank'
                );

            // ----------------------------------------------------
            // If browser blocks second popup, PDF is still opened
            // ----------------------------------------------------

            if (!downloadWindow) {

                this.showToast(
                    'Success',
                    'Cost Sheet generated. Please use the opened PDF to download it.',
                    'success'
                );

            } else {

                this.showToast(
                    'Success',
                    'Cost Sheet generated successfully.',
                    'success'
                );
            }

        } catch (error) {

            if (pdfWindow && !pdfWindow.closed) {
                pdfWindow.close();
            }

            this.showToast(
                'Error',
                this.reduceError(error),
                'error'
            );

        } finally {

            this.isGenerating =
                false;
        }
    }


    // ============================================================
    // GETTERS
    // ============================================================

    get showSearch() {

        return !this.selectedOpportunity;
    }


    get showCustomerDetails() {

        return !!this.selectedOpportunity;
    }


    get hasSearchResults() {

        return (
            this.searchResults &&
            this.searchResults.length > 0
        );
    }


    get allowBackToSearch() {

        return !this.urlOpportunityMode;
    }


    // ============================================================
    // ERROR HANDLING
    // ============================================================

    reduceError(error) {

        if (error?.body?.message) {
            return error.body.message;
        }

        if (error?.message) {
            return error.message;
        }

        if (
            Array.isArray(error?.body) &&
            error.body.length
        ) {
            return error.body
                .map(item => item.message)
                .join(', ');
        }

        return 'Something went wrong.';
    }


    // ============================================================
    // TOAST
    // ============================================================

    showToast(
        title,
        message,
        variant
    ) {

        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
    // ============================================================
// OPEN FEEDBACK SECTION
// ============================================================

handleAddFeedback() {

    this.feedbackText = '';

    this.showFeedbackForm = true;
}


// ============================================================
// FEEDBACK TEXT CHANGE
// ============================================================

handleFeedbackChange(event) {

    this.feedbackText = event.target.value;
}


// ============================================================
// CANCEL FEEDBACK
// ============================================================

handleCancelFeedback() {

    this.showFeedbackForm = false;

    this.feedbackText = '';
}


// ============================================================
// SUBMIT FEEDBACK
// ============================================================

async handleSubmitFeedback() {

    // Validate Unit
    if (!this.recordId) {

        this.showToast(
            'Error',
            'Unit record ID is missing.',
            'error'
        );

        return;
    }

    // Validate Opportunity
    if (!this.opportunityId) {

        this.showToast(
            'Error',
            'Opportunity is missing.',
            'error'
        );

        return;
    }

    // Validate Contact
    if (!this.selectedOpportunity?.contactId) {

        this.showToast(
            'Error',
            'Contact is not associated with this Opportunity.',
            'error'
        );

        return;
    }

    // Validate Feedback
    if (!this.feedbackText || !this.feedbackText.trim()) {

        this.showToast(
            'Validation',
            'Please enter feedback before submitting.',
            'warning'
        );

        return;
    }

    this.isSubmittingFeedback = true;

    try {

        const result = await createSiteVisitFeedback({

            unitId: this.recordId,

            contactId:
                this.selectedOpportunity.contactId,

            opportunityId:
                this.opportunityId,

            feedback:
                this.feedbackText.trim()

        });

        if (result) {

            this.showToast(
                'Success',
                'Customer feedback submitted successfully.',
                'success'
            );

            // Clear feedback
            this.feedbackText = '';

            // Hide feedback section
            this.showFeedbackForm = false;

        }

    } catch (error) {

        this.showToast(
            'Error',
            this.reduceError(error),
            'error'
        );

    } finally {

        this.isSubmittingFeedback = false;
    }
}
}