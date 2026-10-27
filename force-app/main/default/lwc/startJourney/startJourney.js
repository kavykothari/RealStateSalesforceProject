import { LightningElement, api } from 'lwc';
import updateOpportunityStage
    from '@salesforce/apex/OpportunityBookingDocumentController.updateOpportunityStage';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { RefreshEvent } from 'lightning/refresh';

export default class StartJourney extends LightningElement {

    @api recordId;
    isLoading = false;

    async handleStartJourney() {
        if (this.isLoading) {
            return;
        }

        const newTab = window.open('about:blank', '_blank');

        if (!newTab) {
            this.showToast(
                'Popup Blocked',
                'Please allow pop-ups for Salesforce and try again.',
                'warning'
            );
            return;
        }

        this.isLoading = true;

        try {
            // Update Opportunity stage
            await updateOpportunityStage({
                opportunityId: this.recordId
            });

            // Refresh the current Salesforce record page
            this.dispatchEvent(new RefreshEvent());

            this.showToast(
                'Success',
                'Opportunity stage updated to Property Finalisation.',
                'success'
            );

            // Open property inventory in a new tab
            newTab.location.href =
                `/lightning/page/home?c__opportunityId=${encodeURIComponent(this.recordId)}`;

        } catch (error) {
            newTab.close();

            this.showToast(
                'Error',
                error?.body?.message ||
                    'Unable to update Opportunity stage.',
                'error'
            );
        } finally {
            this.isLoading = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}