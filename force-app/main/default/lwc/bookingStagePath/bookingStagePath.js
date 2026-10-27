import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

import getBookingForRecord
    from '@salesforce/apex/OpportunityBookingDocumentController.getBookingForRecord';

import {
    getRecord,
    getFieldValue
} from 'lightning/uiRecordApi';

import BOOKING_ID from '@salesforce/schema/Booking__c.Id';
import BOOKING_NAME from '@salesforce/schema/Booking__c.Name';
import BOOKING_STAGE from '@salesforce/schema/Booking__c.Stage__c';
import CANCELLATION_DATE from '@salesforce/schema/Booking__c.Cancellation_Date__c';
import CANCELLATION_REASON from '@salesforce/schema/Booking__c.Cancellation_Reason__c';

const BOOKING_FIELDS = [
    BOOKING_ID,
    BOOKING_NAME,
    BOOKING_STAGE,
    CANCELLATION_DATE,
    CANCELLATION_REASON
];

const BOOKING_STAGES = [
    'Under Review',
    'Documents Verified',
    'Agreement & Registration Drafting',
    'Agreement & Registration Pending',
    'Booking Confirmed'
];

export default class BookingStagePath extends NavigationMixin(LightningElement) {
    _recordId;
    _objectApiName;

    bookingId;
    bookingName;
    bookingStage;
    cancellationDate;
    cancellationReason;
    bookingUrl;

    isLoading = true;
    hasLoaded = false;
    errorMessage;
    debugMessage = 'Waiting for Salesforce record context...';

    lastLoadKey;
    requestNumber = 0;
    timeoutId;

    // --------------------------------------------------
    // Salesforce record context
    // --------------------------------------------------

    @api
    get recordId() {
        return this._recordId;
    }

    set recordId(value) {
        if (this._recordId === value) {
            return;
        }

        this._recordId = value;
        this.lastLoadKey = undefined;

        this.inferObjectApiName();
        this.startLoadIfReady();
    }

    @api
    get objectApiName() {
        return this._objectApiName;
    }

    set objectApiName(value) {
        if (!value || this._objectApiName === value) {
            return;
        }

        this._objectApiName = value;
        this.lastLoadKey = undefined;
        this.startLoadIfReady();
    }

    connectedCallback() {
        this.inferObjectApiName();
        this.startLoadIfReady();
    }

    disconnectedCallback() {
        this.clearRequestTimeout();
        this.requestNumber++;
    }

    inferObjectApiName() {
        if (!this._recordId || this._objectApiName) {
            return;
        }

        const prefix = this._recordId.substring(0, 3);

        if (prefix === 'a4v') {
            this._objectApiName = 'Booking__c';
        } else if (prefix === '006') {
            this._objectApiName = 'Opportunity';
        }
    }

    // --------------------------------------------------
    // Reactive Booking record fields
    // Automatically updates when LDS receives record changes
    // --------------------------------------------------

    @wire(getRecord, {
        recordId: '$bookingId',
        fields: BOOKING_FIELDS
    })
    wiredBookingRecord({ data, error }) {
        if (data) {
            this.bookingName = getFieldValue(
                data,
                BOOKING_NAME
            );

            this.bookingStage = getFieldValue(
                data,
                BOOKING_STAGE
            );

            this.cancellationDate = getFieldValue(
                data,
                CANCELLATION_DATE
            );

            this.cancellationReason = getFieldValue(
                data,
                CANCELLATION_REASON
            );

            this.debugMessage =
                `Booking record refreshed. Name: ${this.bookingName || data.id}. ` +
                `Stage: ${this.bookingStage || '(blank)'}`;
        } else if (error) {
            this.debugMessage =
                'Unable to read Booking fields: ' +
                (error?.body?.message || error?.message || 'Unknown error');
        }
    }

    // --------------------------------------------------
    // Find Booking for Booking or Opportunity record
    // --------------------------------------------------

    startLoadIfReady() {
        if (!this.isConnected) {
            return;
        }

        this.inferObjectApiName();

        if (!this._recordId || !this._objectApiName) {
            this.isLoading = false;
            this.hasLoaded = true;

            this.debugMessage =
                `Missing context. Record ID: ${this._recordId || 'missing'}, ` +
                `Object: ${this._objectApiName || 'missing'}`;

            return;
        }

        if (
            this._objectApiName !== 'Booking__c' &&
            this._objectApiName !== 'Opportunity'
        ) {
            this.isLoading = false;
            this.hasLoaded = true;
            this.errorMessage =
                `Unsupported object: ${this._objectApiName}`;
            this.debugMessage = this.errorMessage;
            return;
        }

        const key = `${this._objectApiName}:${this._recordId}`;

        if (this.lastLoadKey === key) {
            return;
        }

        this.lastLoadKey = key;
        this.loadBooking(key);
    }

    async loadBooking(key) {
        const currentRequest = ++this.requestNumber;

        this.clearRequestTimeout();
        this.clearBooking();

        this.isLoading = true;
        this.hasLoaded = false;
        this.errorMessage = undefined;
        

        this.debugMessage =
            `Loading Booking. Object: ${this._objectApiName}, ` +
            `Record ID: ${this._recordId}`;

        this.timeoutId = setTimeout(() => {
            if (currentRequest !== this.requestNumber) {
                return;
            }

            this.isLoading = false;
            this.hasLoaded = true;

            this.errorMessage =
                'The Booking request timed out. Check Apex access and the browser Console.';

            this.debugMessage = this.errorMessage;
            this.lastLoadKey = undefined;
        }, 15000);

        try {
            const result = await getBookingForRecord({
                recordId: this._recordId,
                objectApiName: this._objectApiName
            });

            if (currentRequest !== this.requestNumber) {
                return;
            }

            this.clearRequestTimeout();

            if (result) {
                // Setting bookingId activates the reactive getRecord wire.
                this.bookingId = result.Id;
                await this.generateBookingUrl();

                // Initial values while the reactive record loads.
                this.bookingName = result.Name;
                this.bookingStage = result.Stage__c;
                this.cancellationDate =
                    result.Cancellation_Date__c;
                this.cancellationReason =
                    result.Cancellation_Reason__c;

                this.debugMessage =
                    `Booking found: ${result.Name || result.Id}. ` +
                    'Waiting for the latest Booking fields.';
            } else {
                this.debugMessage =
                    this._objectApiName === 'Opportunity'
                        ? 'No related Booking was found for this Opportunity.'
                        : 'No Booking record was returned.';
            }
        } catch (error) {
            if (currentRequest !== this.requestNumber) {
                return;
            }

            this.clearRequestTimeout();

            this.errorMessage =
                error?.body?.message ||
                error?.message ||
                'An unexpected error occurred while loading Booking.';

            this.debugMessage = `Apex error: ${this.errorMessage}`;
            this.lastLoadKey = undefined;
        } finally {
            if (currentRequest === this.requestNumber) {
                this.isLoading = false;
                this.hasLoaded = true;
            }
        }
    }
    async generateBookingUrl() {
    if (!this.bookingId) {
        this.bookingUrl = undefined;
        return;
    }

    try {
        this.bookingUrl = await this[NavigationMixin.GenerateUrl]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.bookingId,
                objectApiName: 'Booking__c',
                actionName: 'view'
            }
        });
    } catch (error) {
        this.bookingUrl = undefined;
    }
}
    async generateBookingUrl() {
            if (!this.bookingId) {
                this.bookingUrl = undefined;
                return;
            }

            try {
                this.bookingUrl = await this[NavigationMixin.GenerateUrl]({
                    type: 'standard__recordPage',
                    attributes: {
                        recordId: this.bookingId,
                        objectApiName: 'Booking__c',
                        actionName: 'view'
                    }
                });
            } catch (error) {
                this.bookingUrl = undefined;
            }
    }

    clearRequestTimeout() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
    }

    clearBooking() {
        this.bookingId = undefined;
        this.bookingName = undefined;
        this.bookingStage = undefined;
        this.cancellationDate = undefined;
        this.cancellationReason = undefined;
        this.bookingUrl = undefined;
    }

    // --------------------------------------------------
    // Display states
    // --------------------------------------------------

    get hasBooking() {
        return Boolean(this.bookingId);
    }

    get hasError() {
        return Boolean(this.errorMessage);
    }

    get isOpportunityRecord() {
        return this._objectApiName === 'Opportunity';
    }

    get isBookingRecord() {
        return this._objectApiName === 'Booking__c';
    }

    get noBookingFound() {
        return this.hasLoaded &&
            !this.isLoading &&
            !this.hasError &&
            this.isOpportunityRecord &&
            !this.hasBooking;
    }

    get isCancelled() {
        const stage = (this.bookingStage || '')
            .trim()
            .toLowerCase();

        return stage === 'cancelled' ||
            stage === 'canceled';
    }

    get showNormalPath() {
        return this.hasBooking && !this.isCancelled;
    }

    get showCancelledDetails() {
        return this.hasBooking && this.isCancelled;
    }

    // --------------------------------------------------
    // Cancellation information
    // --------------------------------------------------

    get formattedCancellationDate() {
        if (!this.cancellationDate) {
            return 'Not provided';
        }

        const parts = this.cancellationDate.split('-');

        if (parts.length !== 3) {
            return this.cancellationDate;
        }

        const date = new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            Number(parts[2])
        );

        if (Number.isNaN(date.getTime())) {
            return this.cancellationDate;
        }

        return new Intl.DateTimeFormat('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(date);
    }

    get displayedCancellationReason() {
        return this.cancellationReason || 'No reason provided';
    }

    // --------------------------------------------------
    // Booking stage path
    // --------------------------------------------------

    get currentStageIndex() {
        return BOOKING_STAGES.indexOf(this.bookingStage);
    }

    get hasRecognizedStage() {
        return this.currentStageIndex !== -1;
    }

    get unrecognizedStageMessage() {
        if (!this.bookingStage) {
            return 'The Stage__c field is blank. Check the Booking record.';
        }

        return `Stage "${this.bookingStage}" is not included in the configured path. ` +
            'Verify the Stage__c picklist value.';
    }

    get pathSteps() {
        const currentIndex = this.currentStageIndex;

        return BOOKING_STAGES.map((stage, index) => {
            const isCompleted =
                currentIndex >= 0 && index < currentIndex;

            const isCurrent =
                currentIndex >= 0 && index === currentIndex;

            let className = 'stage-step upcoming';

            if (isCompleted) {
                className = 'stage-step completed';
            } else if (isCurrent) {
                className = 'stage-step current';
            }

            return {
                value: stage,
                label: stage,
                marker: isCompleted ? '✓' : String(index + 1),
                isCompleted,
                isCurrent,
                className
            };
        });
    }
    
}