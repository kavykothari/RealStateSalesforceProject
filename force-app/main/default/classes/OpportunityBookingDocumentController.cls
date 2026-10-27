public with sharing class OpportunityBookingDocumentController {

    /*
     * Supports:
     * 1. Flat Booking Application Form
     * 2. KYC / Customer Information Form
     * 3. Booking Receipt
     * 4. Final Cost Sheet
     * 6. Proof of Token Amount
     *
     * Files are created in Salesforce Files only when this method
     * is called by the Save action.
     */

    private static final Integer MAX_FILE_SIZE = 2 * 1024 * 1024;

    private static final Set<String> ALLOWED_DOCUMENT_TYPES =
        new Set<String>{
            'Flat Booking Application Form',
            'KYC / Customer Information Form',
            'Booking Receipt',
            'Final Cost Sheet',
            'Proof of Token Amount',
            // Post-booking documents
            'Allotment Letter - Draft',
            'Allotment Letter - Executed Copy',
            'Payment / Registration Evidence',
            'Home Loan Supporting Documents'
        };

            @AuraEnabled
            public static void updateOpportunityStage(Id opportunityId) {

                if (opportunityId == null) {
                    throw new AuraHandledException('Opportunity Id is required.');
                }

                Opportunity opp = [
                    SELECT Id, StageName
                    FROM Opportunity
                    WHERE Id = :opportunityId
                    LIMIT 1
                ];

                opp.StageName = 'Property Finalisation';
                update opp;
            }
    private static final Set<String> ALLOWED_EXTENSIONS =
        new Set<String>{
            'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'
        };

    /**
     * Uploads a single document and links it to an Opportunity.
     *
     * Parameters must match the LWC import call:
     * uploadDocument({
     *     opportunityId,
     *     documentType,
     *     fileName,
     *     base64Data
     * })
     */
			@AuraEnabled
		public static Boolean isUnitAvailable(Id unitId) {
			if (unitId == null ||
				unitId.getSObjectType() != Unit__c.SObjectType) {
				throw new AuraHandledException('Invalid Unit record.');
			}

			List<Unit__c> units = [
				SELECT Id, Flat_Status__c
				FROM Unit__c
				WHERE Id = :unitId
				WITH USER_MODE
				LIMIT 1
			];

			if (units.isEmpty()) {
				throw new AuraHandledException(
					'Unit not found or you do not have access to it.'
				);
			}

			return units[0].Flat_Status__c == 'Available';
		}
    @AuraEnabled
    public static Id uploadDocument(
        Id opportunityId,
        String documentType,
        String fileName,
        String base64Data,
		String tokenAmountReceivedAs
    ) {
        validateInput(
            opportunityId,
            documentType,
            fileName,
            base64Data
        );

        // Verify that the current user can access this Opportunity.
        List<Opportunity> opportunities = [
            SELECT Id
            FROM Opportunity
            WHERE Id = :opportunityId
            WITH USER_MODE
            LIMIT 1
        ];

        if (opportunities.isEmpty()) {
            throw new AuraHandledException(
                'The Opportunity could not be found or accessed.'
            );
        }

        Blob fileBody;

        try {
            fileBody = EncodingUtil.base64Decode(base64Data);
        } catch (Exception ex) {
            throw new AuraHandledException(
                'The selected file contains invalid encoded data.'
            );
        }

        if (fileBody.size() == 0 || fileBody.size() > MAX_FILE_SIZE) {
            throw new AuraHandledException(
                'Each file must be greater than 0 bytes and no larger than 2 MB.'
            );
        }

        String extension = getExtension(fileName);

        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new AuraHandledException(
                'Unsupported file type. Upload PDF, DOC, DOCX, JPG, JPEG or PNG.'
            );
        }

        /*
         * FirstPublishLocationId automatically links the newly created
         * Salesforce File to the Opportunity.
         */
        ContentVersion contentVersion = new ContentVersion();
        contentVersion.Title = fileName.substring(
            0,
            fileName.lastIndexOf('.')
        );
        contentVersion.PathOnClient = fileName;
        contentVersion.VersionData = fileBody;
        contentVersion.FirstPublishLocationId = opportunityId;

        try {
            insert  contentVersion;
				 Opportunity opp = new Opportunity(Id = opportunityId);

			if(documentType == 'Proof of Token Amount'){
			 opp.Token_Amount_Received__c = true;
			 opp.Token_Amount_Received_As__c = tokenAmountReceivedAs;
			 opp.StageName = 'Token Amount Received';
			 update opp;
			}else if(documentType == 'Allotment Letter - Draft'){
					opp.Allotment_Letter_Draft__c = true;
			    update opp;
			}else if(documentType == 'Allotment Letter - Executed Copy'){
					opp.Allotment_Letter_Executed_Copy__c = true;
			    update opp;
			}else if(documentType == 'Payment / Registration Evidence'){
					opp.Payment_Registration_Evidence__c = true;
			    update opp;
			}else if(documentType == 'Home Loan Supporting Documents'){
					opp.Home_Loan_Supporting_Documents__c = true;
			    update opp;
			}else{
					opp.Flat_Booking_Application_Form__c = true;
			 opp.KYC_Customer_Information_Form__c = true;
			 opp.Final_Cost_Sheet__c = true;
			 opp.Booking_Receipt__c = true;
			 opp.StageName = 'Booking Done';
			 update opp;

			}

        } catch (Exception ex) {
            throw new AuraHandledException(
                'Unable to upload ' + fileName + ': ' + ex.getMessage()
            );
        }

        return contentVersion.Id;
    }

    /**
     * Validates the incoming upload request.
     */
    private static void validateInput(
        Id opportunityId,
        String documentType,
        String fileName,
        String base64Data
    ) {
        if (opportunityId == null ||
            opportunityId.getSObjectType() != Opportunity.SObjectType) {
            throw new AuraHandledException(
                'A valid Opportunity record is required.'
            );
        }

        if (String.isBlank(documentType) ||
            !ALLOWED_DOCUMENT_TYPES.contains(documentType)) {
            throw new AuraHandledException(
                'Invalid document type.'
            );
        }

        if (String.isBlank(fileName) ||
            fileName.length() > 255 ||
            fileName.contains('\\') ||
            fileName.contains('\n') ||
            fileName.contains('\r')) {
            throw new AuraHandledException(
                'Please provide a valid file name.'
            );
        }

        if (String.isBlank(base64Data)) {
            throw new AuraHandledException(
                'No file data was received.'
            );
        }

        // Reject oversized encoded payloads before decoding.
        Long maxEncodedLength = ((Long) MAX_FILE_SIZE * 4 / 3) + 8;

        if (base64Data.length() > maxEncodedLength) {
            throw new AuraHandledException(
                'The file exceeds the maximum allowed size of 2 MB.'
            );
        }
    }

    /**
     * Returns the lowercase file extension.
     */
    private static String getExtension(String fileName) {
        Integer dotPosition = fileName.lastIndexOf('.');

        if (dotPosition < 0 || dotPosition == fileName.length() - 1) {
            return '';
        }

        return fileName.substring(dotPosition + 1).toLowerCase();
    }


   

   
    @AuraEnabled
    public static Booking__c getBookingForRecord(
        Id recordId,
        String objectApiName
    ) {
        if (recordId == null || String.isBlank(objectApiName)) {
            throw new AuraHandledException(
                'Record ID or object API name was not supplied.'
            );
        }

        if (objectApiName == 'Booking__c') {
            List<Booking__c> records = [
                SELECT Id,
                       Name,
                       Stage__c,
                       Cancellation_Date__c,
                       Cancellation_Reason__c,
                       Opportunity__c
                FROM Booking__c
                WHERE Id = :recordId
                LIMIT 1
            ];

            return records.isEmpty() ? null : records[0];
        }

        if (objectApiName == 'Opportunity') {
            List<Booking__c> records = [
                SELECT Id,
                       Name,
                       Stage__c,
                       Cancellation_Date__c,
                       Cancellation_Reason__c,
                       Opportunity__c
                FROM Booking__c
                WHERE Opportunity__c = :recordId
                ORDER BY CreatedDate DESC
                LIMIT 1
            ];

            return records.isEmpty() ? null : records[0];
        }

        throw new AuraHandledException(
            'BookingStagePath does not support object: ' +
            objectApiName
        );
    }


}