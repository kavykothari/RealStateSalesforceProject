public with sharing class BookingOpportunityFilesController {

    private static final Integer MAX_FILE_SIZE = 5 * 1024 * 1024;

    private static final Set<String> ALLOWED_EXTENSIONS =
        new Set<String>{
            'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'
        };

    // =========================================================
    // FILE WRAPPER
    // =========================================================

    public class FileWrapper {
        @AuraEnabled public String title { get; set; }
        @AuraEnabled public String fileType { get; set; }
        @AuraEnabled public Id latestPublishedVersionId { get; set; }
        @AuraEnabled public Datetime createdDate { get; set; }
        @AuraEnabled public String createdByName { get; set; }
        @AuraEnabled public String contentDocumentId { get; set; }
        @AuraEnabled public String fileSize { get; set; }

        public FileWrapper(ContentDocument doc) {
            title = doc.Title;
            fileType = doc.FileType;
            createdDate = doc.CreatedDate;
            createdByName = doc.CreatedBy.Name;
            contentDocumentId = doc.Id;
            latestPublishedVersionId = doc.LatestPublishedVersionId;

            Decimal bytes = doc.ContentSize;

            if (bytes < 1024) {
                fileSize = String.valueOf(bytes) + ' B';
            } else if (bytes < 1048576) {
                fileSize = String.valueOf(
                    (bytes / 1024).setScale(1)
                ) + ' KB';
            } else {
                fileSize = String.valueOf(
                    (bytes / 1048576).setScale(2)
                ) + ' MB';
            }
        }
    }

    // =========================================================
    // LOCK BOOKING RECORD
    // =========================================================

    private static Booking__c lockBooking(Id bookingId) {

        if (bookingId == null) {
            throw new AuraHandledException(
                'Booking ID is required.'
            );
        }

        List<Booking__c> bookings = [
            SELECT Id, Opportunity__c, Documents_Verified__c
            FROM Booking__c
            WHERE Id = :bookingId
            LIMIT 1
            FOR UPDATE
        ];

        if (bookings.isEmpty()) {
            throw new AuraHandledException(
                'Booking record was not found or you do not have access.'
            );
        }

        return bookings[0];
    }

    // =========================================================
    // GET OPPORTUNITY FILES
    // =========================================================

    @AuraEnabled(cacheable=true)
    public static List<FileWrapper> getOpportunityFiles(
        Id bookingId
    ) {
        if (bookingId == null) {
            throw new AuraHandledException(
                'Booking ID is required.'
            );
        }

        List<Booking__c> bookings = [
            SELECT Id, Opportunity__c
            FROM Booking__c
            WHERE Id = :bookingId
            WITH USER_MODE
            LIMIT 1
        ];

        if (bookings.isEmpty()) {
            throw new AuraHandledException(
                'Booking record was not found or you do not have access.'
            );
        }

        Id opportunityId = bookings[0].Opportunity__c;

        if (opportunityId == null) {
            return new List<FileWrapper>();
        }

        // First query: retrieve linked document IDs.
        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :opportunityId
            WITH USER_MODE
        ];

        Set<Id> documentIds = new Set<Id>();

        for (ContentDocumentLink link : links) {
            if (link.ContentDocumentId != null) {
                documentIds.add(link.ContentDocumentId);
            }
        }

        List<FileWrapper> results = new List<FileWrapper>();

        if (documentIds.isEmpty()) {
            return results;
        }

        // Second query: retrieve file details and creator.
        for (ContentDocument doc : [
            SELECT Id,
                   Title,
                   FileType,
                   CreatedDate,
                   CreatedBy.Name,
                   ContentSize,
                   LatestPublishedVersionId
            FROM ContentDocument
            WHERE Id IN :documentIds
            WITH USER_MODE
            ORDER BY CreatedDate DESC
        ]) {
            results.add(new FileWrapper(doc));
        }

        return results;
    }

    // =========================================================
    // GET DOCUMENT VERIFICATION STATUS
    // =========================================================

    @AuraEnabled(cacheable=true)
    public static Boolean getVerificationStatus(Id bookingId) {

        if (bookingId == null) {
            throw new AuraHandledException(
                'Booking ID is required.'
            );
        }

        List<Booking__c> bookings = [
            SELECT Id, Documents_Verified__c
            FROM Booking__c
            WHERE Id = :bookingId
            WITH USER_MODE
            LIMIT 1
        ];

        if (bookings.isEmpty()) {
            throw new AuraHandledException(
                'Booking record was not found or you do not have access.'
            );
        }

        return bookings[0].Documents_Verified__c == true;
    }

    // =========================================================
    // REPLACE EXISTING FILE
    // Upload replacement first, then remove the old file link.
    // =========================================================

    @AuraEnabled
    public static void replaceFile(
        Id bookingId,
        Id oldContentDocumentId,
        String fileName,
        String base64Data
    ) {
        if (bookingId == null ||
            oldContentDocumentId == null ||
            String.isBlank(fileName) ||
            String.isBlank(base64Data)) {

            throw new AuraHandledException(
                'Booking, existing file, file name and replacement file are required.'
            );
        }

        // Lock the Booking before checking verification status.
        Booking__c booking = lockBooking(bookingId);

        if (booking.Documents_Verified__c == true) {
            throw new AuraHandledException(
                'Documents have been verified. File replacement is no longer allowed.'
            );
        }

        if (booking.Opportunity__c == null) {
            throw new AuraHandledException(
                'This Booking is not linked to an Opportunity.'
            );
        }

        // Validate the filename and extension.
        String safeName = fileName.trim();
        Integer dotPosition = safeName.lastIndexOf('.');

        if (dotPosition <= 0 ||
            dotPosition == safeName.length() - 1) {

            throw new AuraHandledException(
                'The selected file must have a valid extension.'
            );
        }

        String extension = safeName
            .substring(dotPosition + 1)
            .toLowerCase();

        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new AuraHandledException(
                'Allowed file types are PDF, DOC, DOCX, JPG, JPEG and PNG.'
            );
        }

        // Confirm that the old file belongs to this Opportunity.
        List<ContentDocumentLink> oldLinks = [
            SELECT Id, ContentDocumentId
            FROM ContentDocumentLink
            WHERE ContentDocumentId = :oldContentDocumentId
              AND LinkedEntityId = :booking.Opportunity__c
            WITH USER_MODE
            LIMIT 1
        ];

        if (oldLinks.isEmpty()) {
            throw new AuraHandledException(
                'The existing file is not attached to this Opportunity.'
            );
        }

        // Decode the new file.
        Blob fileBody;

        try {
            fileBody = EncodingUtil.base64Decode(base64Data);
        } catch (Exception e) {
            throw new AuraHandledException(
                'Unable to read the replacement file. Please select it again.'
            );
        }

        if (fileBody.size() == 0) {
            throw new AuraHandledException(
                'The selected file is empty.'
            );
        }

        if (fileBody.size() > MAX_FILE_SIZE) {
            throw new AuraHandledException(
                'Maximum replacement file size is 5 MB.'
            );
        }

        String title = safeName.substring(0, dotPosition);

        if (title.length() > 255) {
            title = title.substring(0, 255);
        }
        // Get the existing file's title before replacing it
        ContentDocument oldDocument = [
            SELECT Id, Title, FileExtension
            FROM ContentDocument
            WHERE Id = :oldContentDocumentId
            LIMIT 1
        ];

        // Preserve the existing file name
        String previousTitle = oldDocument.Title;
        String titlePrefix = previousTitle.contains('-')
                            ? previousTitle.substringBefore('-').trim()
                            : previousTitle.trim();

        // Create the replacement file and attach it to Opportunity.
        ContentVersion newVersion = new ContentVersion(
            Title = titlePrefix + ' - ' +title,
            PathOnClient = safeName,
            VersionData = fileBody,
            FirstPublishLocationId = booking.Opportunity__c
        );

        try {
            insert as user newVersion;
        } catch (Exception e) {
            throw new AuraHandledException(
                'The replacement file could not be uploaded. ' +
                'Check your Salesforce Files permissions.'
            );
        }

        // Remove the old file link after the new file is created.
        // An unhandled failure rolls back the transaction.
        try {
            delete as user oldLinks;
        } catch (Exception e) {
            throw new AuraHandledException(
                'The new file was uploaded, but the old file link could not be removed. ' +
                'Check your Salesforce Files permissions.'
            );
        }

        // Preserve the old document if another record still uses it.
        List<ContentDocumentLink> remainingLinks = [
            SELECT Id
            FROM ContentDocumentLink
            WHERE ContentDocumentId = :oldContentDocumentId
            LIMIT 1
        ];

        if (remainingLinks.isEmpty()) {

            List<ContentDocument> oldDocuments = [
                SELECT Id
                FROM ContentDocument
                WHERE Id = :oldContentDocumentId
                LIMIT 1
            ];

            if (!oldDocuments.isEmpty()) {
                try {
                    delete as user oldDocuments;
                } catch (Exception e) {
                    throw new AuraHandledException(
                        'The old file could not be deleted. ' +
                        'Check your Salesforce Files permissions.'
                    );
                }
            }
        }
    }

    // =========================================================
    // VERIFY ALL DOCUMENTS
    // Sets Documents_Verified__c to TRUE.
    // =========================================================

    @AuraEnabled
    public static void verifyAllDocuments(Id bookingId) {

        Booking__c booking = lockBooking(bookingId);

        // Do not modify an already verified Booking.
        if (booking.Documents_Verified__c == true) {
            return;
        }

        booking.Documents_Verified__c = true;

        try {
            update as user booking;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Unable to verify documents. Check your Booking permissions.'
            );
        }
    }
    
@AuraEnabled
public static String uploadAgreementDocument(
    Id bookingId,
    String documentType,
    String fileName,
    String base64Data
) {
    if (bookingId == null) {
        throw new AuraHandledException('Booking record ID is required.');
    }

    if (String.isBlank(fileName) || String.isBlank(base64Data)) {
        throw new AuraHandledException('Please select a file to upload.');
    }

    // Only these two document types are supported.
    String checkboxField;
    String titlePrefix;

    if (documentType == 'DRAFT') {
        checkboxField = 'Agreement_for_Sale_Draft__c';
        titlePrefix = 'Agreement for Sale Draft';
    } else if (documentType == 'EXECUTED') {
        checkboxField = 'Agreement_for_Sale_Executed_Copy__c';
        titlePrefix = 'Agreement for Sale Executed Copy';
    } else {
        throw new AuraHandledException('Invalid agreement document type.');
    }

    Booking__c booking = [
        SELECT Id, Opportunity__c,
               Agreement_for_Sale_Draft__c,
               Agreement_for_Sale_Executed_Copy__c
        FROM Booking__c
        WHERE Id = :bookingId
        LIMIT 1
    ];

    if (booking.Opportunity__c == null) {
        throw new AuraHandledException(
            'No Opportunity is linked to this Booking.'
        );
    }

    // Preserve the document category in the title.
    String cleanFileName = fileName.trim();
    Integer dotPosition = cleanFileName.lastIndexOf('.');
    String baseFileName = dotPosition > 0
        ? cleanFileName.substring(0, dotPosition)
        : cleanFileName;

    String newTitle = titlePrefix + ' - ' + baseFileName;

    // Find the existing file for this document type, if any.
    List<ContentDocumentLink> existingLinks = [
        SELECT Id, ContentDocumentId, ContentDocument.Title
        FROM ContentDocumentLink
        WHERE LinkedEntityId = :booking.Opportunity__c
        AND ContentDocument.Title LIKE :(titlePrefix + ' - %')
        ORDER BY ContentDocument.CreatedDate DESC
        LIMIT 1
    ];

    ContentVersion version = new ContentVersion();
    version.Title = newTitle;
    version.PathOnClient = cleanFileName;
    version.VersionData = EncodingUtil.base64Decode(base64Data);

    if (!existingLinks.isEmpty()) {
        // Upload a new version of the existing document.
        version.ContentDocumentId =
            existingLinks[0].ContentDocumentId;
    } else {
        // First upload: publish the file directly to the Opportunity.
        version.FirstPublishLocationId = booking.Opportunity__c;
    }

    insert version;

    // Mark only the checkbox for the uploaded document.
    booking.put(checkboxField, true);
    update booking;

    return 'SUCCESS';
}

}