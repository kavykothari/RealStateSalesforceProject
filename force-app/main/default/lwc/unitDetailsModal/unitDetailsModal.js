import {
    LightningElement,
    api,
    wire
} from 'lwc';

import {
    NavigationMixin
} from 'lightning/navigation';

import {
    ShowToastEvent
} from 'lightning/platformShowToastEvent';

import {
    getRecord
} from 'lightning/uiRecordApi';

import bookUnit from '@salesforce/apex/AarvyaEstates_TowerInventoryController.bookUnit';

import getTowerInventory from '@salesforce/apex/AarvyaEstates_TowerInventoryController.getTowerInventory';


/* =========================================================
   UNIT FIELDS
   ========================================================= */

const UNIT_FIELDS = [

    'Unit__c.Id',
    'Unit__c.Name',
    'Unit__c.Unit_Flat_Code__c',
    'Unit__c.Facing__c',
    'Unit__c.Flat_Facing_Charges__c',
    'Unit__c.Flat_Facing_View__c',
    'Unit__c.Parking_Charges__c',
    'Unit__c.Floor_Rise_Charges__c',
    'Unit__c.Amenities_Charges__c',
    'Unit__c.Rate_per_Sq_Ft__c',
    'Unit__c.Configuration__c',
    'Unit__c.Super_Built_up_Area_Sq_Ft__c',
    'Unit__c.Total_Amount__c',
    'Unit__c.GST__c',
    'Unit__c.Flat_Status__c',
    'Unit__c.Purchased_By__c',
    'Unit__c.Sold_By__c'
];


/* =========================================================
   STATUS
   ========================================================= */

const STATUS = {

    AVAILABLE: 'Available',

    HOLD: 'Reserved (On Hold)',

    BOOKED: 'Booked'

};


/* =========================================================
   COMPONENT
   ========================================================= */

export default class UnitDetailsModal
    extends NavigationMixin(LightningElement) {


    /* =====================================================
       PRIVATE VARIABLES
       ===================================================== */

    _unitId;

    _towerId;

    _unit = {};

    purchasedById = null;

    bookedById = null;

    reservedOnHoldById = null;

    isBooking = false;

    showModal = false;


    selectedAction;


    /* =====================================================
       PUBLIC UNIT
       ===================================================== */

    @api
    get unit() {

        return this._unit;

    }

    set unit(value) {

        this._unit = value || {};

        /*
         * If parent sends these values, keep them.
         */
        if (value) {

            this.purchasedById =
                value.purchasedById ||
                value.Purchased_By__c ||
                null;

            this.bookedById =
                value.bookedById ||
                value.Sold_By__c ||
                null;

            this.reservedOnHoldById =
                value.reservedOnHoldById ||
                null;
        }

    }


    /* =====================================================
       UNIT ID
       ===================================================== */

    @api
    get unitId() {

        return this._unitId;

    }

    set unitId(value) {

        this._unitId = value;

        if (value) {

            this.showModal = true;

        }

    }


    /* =====================================================
       TOWER ID
       ===================================================== */

    @api
    get towerId() {

        return this._towerId;

    }

    set towerId(value) {

        this._towerId = value;

    }


    /* =====================================================
       GET UNIT RECORD
       ===================================================== */

    @wire(getRecord, {
        recordId: '$unitId',
        fields: UNIT_FIELDS
    })
    wiredUnit({
        data,
        error
    }) {

        if (data) {

            /*
             * IMPORTANT:
             * Store Salesforce record using API field names.
             */

            this._unit = {

                Id:
                    data.fields.Id?.value,

                Name:
                    data.fields.Name?.value,

                Unit_Flat_Code__c:
                    data.fields.Unit_Flat_Code__c?.value,

                Facing__c:
                    data.fields.Facing__c?.value,

                Flat_Facing_Charges__c:
                    data.fields.Flat_Facing_Charges__c?.value,

                Flat_Facing_View__c:
                    data.fields.Flat_Facing_View__c?.value,

                Parking_Charges__c:
                    data.fields.Parking_Charges__c?.value,

                Floor_Rise_Charges__c:
                    data.fields.Floor_Rise_Charges__c?.value,

                Amenities_Charges__c:
                    data.fields.Amenities_Charges__c?.value,

                Rate_per_Sq_Ft__c:
                    data.fields.Rate_per_Sq_Ft__c?.value,

                Configuration__c:
                    data.fields.Configuration__c?.value,

                Super_Built_up_Area_Sq_Ft__c:
                    data.fields.Super_Built_up_Area_Sq_Ft__c?.value,

                Total_Amount__c:
                    data.fields.Total_Amount__c?.value,

                GST__c:
                    data.fields.GST__c?.value,

                Flat_Status__c:
                    data.fields.Flat_Status__c?.value,

                Purchased_By__c:
                    data.fields.Purchased_By__c?.value,

                Sold_By__c:
                    data.fields.Sold_By__c?.value,

            };


            /*
             * Set lookup values
             */

            this.purchasedById =
                data.fields.Purchased_By__c?.value ||
                null;

            this.bookedById =
                data.fields.Sold_By__c?.value ||
                null;


        }


        if (error) {

            this.showToast(
                'Error',
                this.reduceError(error),
                'error'
            );

        }

    }


    /* =====================================================
       STATUS CSS
       ===================================================== */

    get selectedUnitStatusClass() {

        switch (this._unit.Flat_Status__c) {

            case STATUS.AVAILABLE:

                return 'status-badge status-available';


            case STATUS.HOLD:

                return 'status-badge status-hold';


            case STATUS.BOOKED:

                return 'status-badge status-booked';


            default:

                return 'status-badge';

        }

    }



    /* =====================================================
       CONTACT LOOKUPS
       ===================================================== */

    handlePurchasedByChange(event) {

        this.purchasedById = this.getLookupId(event.detail.value);

    }


    handleBookedByChange(event) {

       this.bookedById = this.getLookupId(event.detail.value);

    }
    getLookupId(value) {
    if (!value) {
        return null;
    }

    if (Array.isArray(value)) {
        return value.length ? value[0] : null;
    }

    return value;
}


    handleReservedOnHoldByChange(event) {

       this.reservedOnHoldById = this.getLookupId(event.detail.value);

    }


    /* =====================================================
       BOOK UNIT
       ===================================================== */

    async handleBookUnit() {

        /*
         * IMPORTANT:
         *
         * Previously you had:
         *
         * this.unit.id
         *
         * But your record uses:
         *
         * this.unit.Id
         *
         * Even better, use the @api unitId because
         * that is guaranteed to be the Salesforce Id.
         */

        if (!this.unitId) {

            this.showToast(
                'Error',
                'Unit information is missing.',
                'error'
            );

            return;

        }
        if (!this.purchasedById) {
    this.showToast(
        'Required',
        'Please select a Contact in Purchased By.',
        'warning'
    );
    return;
}


        /*
         * Booked By is required
         */

        if (!this.bookedById && !this.reservedOnHoldById ) {

            this.showToast(
                'Required',
                'Please select a Contact in Booked By or Reserved By.',
                'warning'
            );

            return;

        }


        this.isBooking = true;


        try {

            /*
             * Call Apex
             *
             * IMPORTANT:
             * unitId is used here.
             */

            await bookUnit({

                unitId:
                    this.unitId,

                purchasedById:
                    this.purchasedById || null,

                bookedById:
                    this.bookedById || null,

                reservedOnHoldById:
                    this.reservedOnHoldById || null

            });


            /*
             * SUCCESS
             */
            /*
             * Notify parent
             */

            this.dispatchEvent(
                new CustomEvent(
                    'booksuccess',
                    {
                        detail: {
                            unitId: this.unitId
                        },

                        bubbles: true,

                        composed: true
                    }
                )
            );


            /*
             * Close modal
             */

            this.closeModal();

        }

        catch (error) {

            const message =
                this.reduceError(error);


            this.showToast(
                'Booking Failed',
                message,
                'error'
            );

        }

        finally {

            this.isBooking = false;

        }

    }


    /* =====================================================
       NAVIGATE TO UNIT
       ===================================================== */

    navigateToUnit() {

        this[NavigationMixin.Navigate]({

            type: 'standard__recordPage',

            attributes: {

                recordId:
                    this.unitId,

                objectApiName:
                    'Unit__c',

                actionName:
                    'view'

            }

        });

    }


    /* =====================================================
       GENERATE COST SHEET
       ===================================================== */

handleGenerateCostSheet() {

    const generator =
        this.template.querySelector(
            'c-cost-sheet-generator'
        );

    if (!generator) {

        this.showToast(
            'Error',
            'Cost Sheet component is not available.',
            'error'
        );

        return;
    }

    generator.generate();
    this.showBookUnitButton = true;
}


    /* =====================================================
       CLOSE MODAL
       ===================================================== */

    closeModal() {

        this.showModal = false;


        this.dispatchEvent(
            new CustomEvent('close')
        );

    }


    /* =====================================================
       TOAST
       ===================================================== */

    showToast(
        title,
        message,
        variant
    ) {

        this.dispatchEvent(
            new ShowToastEvent({

                title: title,

                message: message,

                variant: variant,

                mode: 'dismissable'

            })
        );

    }


    /* =====================================================
       ERROR HANDLER
       ===================================================== */

    reduceError(error) {

        if (!error) {

            return 'Unknown error';

        }


        if (
            Array.isArray(error.body)
        ) {

            return error.body
                .map(e => e.message)
                .join(', ');

        }


        if (
            error.body?.message
        ) {

            return error.body.message;

        }


        return error.message ||
            'Unknown error';

    }

}