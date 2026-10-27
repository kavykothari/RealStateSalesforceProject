import { LightningElement, api, wire } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from 'lightning/actions';

import getFollowUpContext
    from '@salesforce/apex/TaskDashboardController.getFollowUpContext';

import createFollowUpTask
    from '@salesforce/apex/TaskDashboardController.createFollowUpTask';

export default class TaskFollowUp extends NavigationMixin(
    LightningElement
) {
    // Unit record ID supplied by the Salesforce record page.
    _recordId;

    @api
    get recordId() {
        return this._recordId;
    }

    set recordId(value) {
        if (value && value !== this._recordId) {
            this._recordId = value;
            this.loadContext();
        }
    }

    // URL context
    opportunityId;
    pageReferenceLoaded = false;

    // Contact context
    contactId;

    // Form fields
    followUpDate;
    description = '';

    // UI state
    isLoading = true;
    isSaving = false;
    initialized = false;

    // Prevent duplicate context requests.
    requestInProgress = false;

    @wire(CurrentPageReference)
    getPageReference(pageRef) {
        if (!pageRef) {
            return;
        }

        const newOpportunityId =
            pageRef.state?.c__opportunityId || null;

        const opportunityChanged =
            newOpportunityId !== this.opportunityId;

        this.opportunityId = newOpportunityId;
        this.pageReferenceLoaded = true;

        if (opportunityChanged) {
            this.initialized = false;
            this.description = '';
            this.contactId = null;
        }

        this.loadContext();
    }

    async loadContext() {
        // Wait until both the Unit ID and URL state are available.
        if (
            !this.recordId ||
            !this.pageReferenceLoaded ||
            this.initialized ||
            this.requestInProgress
        ) {
            return;
        }

        this.requestInProgress = true;
        this.isLoading = true;

        try {
            const result = await getFollowUpContext({
                unitId: this.recordId,
                opportunityId: this.opportunityId
            });

            this.contactId = result.contactId || null;

            // Populate the description with the available details.
            const descriptionLines = [
                `Unit ID: ${result.unitId || ''}`,
                `Unit Code: ${result.unitCode || ''}`,
                `Contact Phone: ${result.contactPhone || ''}`,
                `Contact Email: ${result.contactEmail || ''}`
            ];

            this.description = descriptionLines.join('\n');
            this.initialized = true;

        } catch (error) {
            this.showToast(
                'Error',
                this.getErrorMessage(error),
                'error'
            );
        } finally {
            this.requestInProgress = false;
            this.isLoading = false;
        }
    }

    // Follow-up date change
    handleDateChange(event) {
        this.followUpDate = event.detail.value;
    }

    // Description change
    handleDescriptionChange(event) {
        this.description = event.detail.value;
    }

    // Create the Salesforce Task
    async handleCreate() {
        if (this.isSaving || this.isLoading) {
            return;
        }

        if (!this.recordId) {
            this.showToast(
                'Error',
                'Unit record ID is missing.',
                'error'
            );
            return;
        }

        if (!this.followUpDate) {
            this.showToast(
                'Required',
                'Please select a follow-up date.',
                'warning'
            );
            return;
        }

        if (!this.description || !this.description.trim()) {
            this.showToast(
                'Required',
                'Please enter a description.',
                'warning'
            );
            return;
        }

        this.isSaving = true;

        try {
            const taskId = await createFollowUpTask({
                unitId: this.recordId,
                opportunityId: this.opportunityId || null,
                contactId: this.contactId || null,
                followUpDate: this.followUpDate,
                description: this.description.trim()
            });

            this.showToast(
                'Success',
                'Follow-up Task created successfully.',
                'success'
            );

            // Close the quick-action modal.
            this.dispatchEvent(new CloseActionScreenEvent());

            // Open the newly created Task.
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: taskId,
                    objectApiName: 'Task',
                    actionName: 'view'
                }
            });

        } catch (error) {
            this.showToast(
                'Error',
                this.getErrorMessage(error),
                'error'
            );
        } finally {
            this.isSaving = false;
        }
    }

    // Cancel the action
    handleCancel() {
        this.dispatchEvent(new CloseActionScreenEvent());
    }

    // Toast helper
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }

    // Extract a readable Salesforce error
    getErrorMessage(error) {
        if (error?.body?.message) {
            return error.body.message;
        }

        if (Array.isArray(error?.body)) {
            return error.body
                .map(item => item.message)
                .join(', ');
        }

        return error?.message ||
            'An unexpected error occurred while processing the request.';
    }
}