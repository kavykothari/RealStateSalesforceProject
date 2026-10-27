import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue, updateRecord } from 'lightning/uiRecordApi';
import OPPORTUNITY_CONTACT_FIELD
    from '@salesforce/schema/Opportunity.ContactId';
import UNIT_PAYMENT_FIELD from
    '@salesforce/schema/Unit__c.Token_Amount_Received_As__c';
import UNIT_TOWER from
    '@salesforce/schema/Unit__c.Tower__c';

import uploadDocument from
    '@salesforce/apex/OpportunityBookingDocumentController.uploadDocument';

    import OPPORTUNITY_TOKEN_RECEIVED_FIELD
    from '@salesforce/schema/Opportunity.Token_Amount_Received__c';

     import OPPORTUNITY_PURCHASEDFLAT
    from '@salesforce/schema/Opportunity.Purchased_Unit_Flat__c';
import OPPORTUNITY_TOWER
    from '@salesforce/schema/Opportunity.Tower__c';
import OPPORTUNITY_TOKEN_METHOD_FIELD
    from '@salesforce/schema/Opportunity.Token_Amount_Received_As__c';
import isUnitAvailable
    from '@salesforce/apex/OpportunityBookingDocumentController.isUnitAvailable';
import USER_ID from '@salesforce/user/Id';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference } from 'lightning/navigation';

const FIELDS = [UNIT_PAYMENT_FIELD,UNIT_TOWER];

export default class TokenAmountProofUpload extends LightningElement {
    currentUserId = USER_ID;

    @api recordId;       // Unit__c record ID
    opportunityId = '';  // Opportunity ID, supplied by the parent or page

    tokenAmountReceivedAs = '';
    files = [];
    isSaving = false;
    isLoaded = false;
    tower = '';

    paymentMethodOptions = [
        { label: 'Cash', value: 'Cash' },
        { label: 'UPI', value: 'UPI' },
        { label: 'RTGS', value: 'RTGS' },
        { label: 'NEFT', value: 'NEFT' },
        { label: 'Cheque', value: 'Cheque' }
    ];
    @wire(CurrentPageReference)
        getPageReference(pageRef) {
            if (!pageRef) {
                return;
            }
            this.opportunityId = pageRef.state?.c__opportunityId;
        }
    contactId;

    @wire(getRecord, {
        recordId: '$opportunityId',
        fields: [OPPORTUNITY_CONTACT_FIELD]
    })
    wiredOpportunity({ data, error }) {
        if (data) {
            this.contactId = getFieldValue(data, OPPORTUNITY_CONTACT_FIELD);
        } else if (error) {
            this.contactId = undefined;
            console.error('Error fetching Opportunity Contact:', error);
        }
    }
    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    wiredUnit({ data, error }) {
        if (data) {
            this.tokenAmountReceivedAs =
                getFieldValue(data, UNIT_PAYMENT_FIELD) || '';
            this.tower =
                getFieldValue(data, UNIT_TOWER) || '';

            this.isLoaded = true;
        } else if (error) {
            this.showToast(
                'Error',
                'Unable to load Unit payment details.',
                'error'
            );
        }
    }

    get isCash() {
        return this.tokenAmountReceivedAs === 'Cash';
    }

    get requiresProof() {
        return !!this.tokenAmountReceivedAs && !this.isCash;
    }

    get hasFiles() {
        return this.files.length > 0;
    }

    get isSaveDisabled() {
        return !this.isLoaded ||
            this.isSaving ||
            !this.tokenAmountReceivedAs ||
            (this.requiresProof &&
                (!this.hasFiles || !this.opportunityId));
    }

    handlePaymentMethodChange(event) {
        this.tokenAmountReceivedAs = event.detail.value;

        // Cash does not need proof files.
        if (this.isCash) {
            this.files = [];
        }
    }

    async handleSave() {
        if (!this.opportunityId) {
                this.showToast(
                    'Info',
                    'Please select a customer first. No customer is currently selected.',
                    'info'
                );
                return;
            }

        if (this.isSaveDisabled) {
            return;
        }

        this.isSaving = true;

        try {
            // Check latest Unit availability before proceeding.
                const available = await isUnitAvailable({
                    unitId: this.recordId
                });

                if (!available) {
                    this.showToast(
                        'Unit Unavailable',
                        'This Unit is no longer available. Please refresh and select another Unit.',
                        'error'
                    );
                    return;
                }
            // Save payment method on the Unit record.
            

            // Cash: save only the Unit field, without uploading files.
            if (this.isCash) {
                    await updateRecord({
                    fields: {
                        Id: this.recordId,
                        [UNIT_PAYMENT_FIELD.fieldApiName]:
                            this.tokenAmountReceivedAs,
                            Token_Amount_Received__c: true,
                            Purchased_By__c : this.contactId,
                            Flat_Status__c : 'Reserved (On Hold)',
                            Opportunity__c : this.opportunityId,
                            Sold_By__c : this.currentUserId

                    }
                });
                    
                this.files = [];
                this.showToast(
                    'Success',
                    'Token payment method saved as Cash.',
                    'success'
                );
                console.log('kavya=> ',this.tower);

                await updateRecord({
                        fields: {
                            Id: this.opportunityId,
                            [OPPORTUNITY_TOKEN_RECEIVED_FIELD.fieldApiName]: true,
                            [OPPORTUNITY_TOKEN_METHOD_FIELD.fieldApiName]: 'Cash',
                            [OPPORTUNITY_PURCHASEDFLAT.fieldApiName]: this.recordId,
                            [OPPORTUNITY_TOWER.fieldApiName]: this.tower


                        }
                    });

                return;
            }else{

                    // Non-cash: upload proof files and attach them to Opportunity.
                    const uploadedIds = [];
                    const failures = [];

                    for (const file of this.files) {
                        try {
                            const base64Data =
                                await this.readFileAsBase64(file.rawFile);

                            await uploadDocument({
                                opportunityId: this.opportunityId,
                                documentType: 'Proof of Token Amount',
                                fileName: `Token Amount - ${file.name}`,
                                base64Data : base64Data,
                                tokenAmountReceivedAs : this.tokenAmountReceivedAs

                            });

                            uploadedIds.push(file.id);
                        } catch (error) {
                            failures.push(
                                `${file.name}: ${error?.body?.message ||
                                error?.message || 'Upload failed'}`
                            );
                        }
                    }

                    this.files = this.files.filter(
                        file => !uploadedIds.includes(file.id)
                    );

                    if (failures.length) {
                        this.showToast(
                            'Partially completed',
                            `${uploadedIds.length} file(s) uploaded. ${failures.join(' | ')}`,
                            'warning'
                        );
                    } else {
                        this.showToast(
                            'Success',
                            'Payment method and proof documents saved successfully.',
                            'success'
                        );
                    }
                await updateRecord({
                    fields: {
                        Id: this.recordId,
                        [UNIT_PAYMENT_FIELD.fieldApiName]:
                            this.tokenAmountReceivedAs,
                            Token_Amount_Received__c: true,
                            Purchased_By__c : this.contactId,
                            Flat_Status__c : 'Reserved (On Hold)',
                            Opportunity__c : this.opportunityId,
                            Sold_By__c : this.currentUserId


                    }
                });
            }
            
        } catch (error) {
            this.showToast(
                'Error',
                error?.body?.message ||
                    error?.message ||
                        'Unable to verify Unit availability or save token payment details. Please try again.',
                'error'
            );
        } finally {
            this.isSaving = false;
        }
    }

  
    handleFileChange(event) {
        const selected = Array.from(event.target.files || []);
        const allowed = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
        const maxSize = 2 * 1024 * 1024;
        const additions = [];

        for (const file of selected) {
            const extension = file.name.split('.').pop().toLowerCase();

            if (!allowed.includes(extension) ||
                file.size === 0 ||
                file.size > maxSize) {
                this.showToast(
                    'Invalid file',
                    `${file.name}: use PDF, DOC, DOCX, JPG or PNG up to 2 MB.`,
                    'error'
                );
                continue;
            }

            const duplicate = this.files.some(
                item => item.name === file.name &&
                    item.size === file.size
            );

            if (!duplicate) {
                additions.push({
                    id: `${Date.now()}_${Math.random()}`,
                    name: file.name,
                    size: file.size,
                    sizeLabel: this.formatFileSize(file.size),
                    rawFile: file
                });
            }
        }

        this.files = [...this.files, ...additions];
        event.target.value = '';
    }

    handleRemove(event) {
        const id = event.currentTarget.dataset.id;
        this.files = this.files.filter(file => file.id !== id);
    }

    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                const result = reader.result;
                resolve(result.substring(result.indexOf(',') + 1));
            };

            reader.onerror = () => reject(
                new Error('Unable to read file.')
            );

            reader.readAsDataURL(file);
        });
    }

    formatFileSize(bytes) {
        return bytes < 1024 * 1024
            ? `${(bytes / 1024).toFixed(1)} KB`
            : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({ title, message, variant })
        );
    }
}