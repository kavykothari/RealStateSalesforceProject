public with sharing class AarvyaEstates_CostSheetController {

    // ============================================================
    // SEARCH CUSTOMERS
    //
    // Flow:
    // Contact
    //    ->
    // OpportunityContactRole
    //    ->
    // Opportunity
    // ============================================================

    public class CouponValidationResult {
    @AuraEnabled public Boolean isValid { get; set; }
    @AuraEnabled public String message { get; set; }
    @AuraEnabled public String couponCode { get; set; }
    @AuraEnabled public Decimal discountValue { get; set; }
    @AuraEnabled public Decimal originalTotal { get; set; }
    @AuraEnabled public Decimal discountedTotal { get; set; }
}

@AuraEnabled
public static CouponValidationResult validateDiscountCoupon(
    Id unitId,
    String couponCode
) {
    CouponValidationResult result = new CouponValidationResult();
    result.isValid = false;
    result.discountValue = 0;
    result.originalTotal = 0;
    result.discountedTotal = 0;

    if (unitId == null || String.isBlank(couponCode)) {
        result.message = 'Enter a coupon code.';
        return result;
    }

    List<Unit__c> units = [
        SELECT Id, Project__c, Total_Amount_All_Inclusive__c
        FROM Unit__c
        WHERE Id = :unitId
        LIMIT 1
    ];

    if (units.isEmpty() || units[0].Project__c == null) {
        result.message = 'Unable to identify the Unit project.';
        return result;
    }

    Unit__c unitRecord = units[0];
    result.originalTotal =
        unitRecord.Total_Amount_All_Inclusive__c == null
        ? 0
        : unitRecord.Total_Amount_All_Inclusive__c;

    result.discountedTotal = result.originalTotal;

    List<Discount_Policy__c> policies = [
        SELECT Id, Discount_Code__c, Active__c,
               Discount_Value__c, Applicable_Project__c
        FROM Discount_Policy__c
        WHERE Discount_Code__c = :couponCode.trim()
          AND Active__c = true
          AND Applicable_Project__c = :unitRecord.Project__c
        LIMIT 1
    ];

    if (policies.isEmpty()) {
        result.message =
            'Invalid coupon code, inactive coupon, or coupon not applicable to this project.';
        return result;
    }

    Discount_Policy__c policy = policies[0];

    if (policy.Discount_Value__c == null ||
        policy.Discount_Value__c <= 0) {
        result.message = 'This coupon has no valid discount value.';
        return result;
    }

    // Fixed currency discount, capped at the payable amount.
    Decimal discount = Math.min(
        policy.Discount_Value__c,
        result.originalTotal
    );

    result.isValid = true;
    result.couponCode = policy.Discount_Code__c;
    result.discountValue = discount;
    result.discountedTotal = result.originalTotal - discount;
    result.message = 'Coupon applied successfully.';

    return result;
}

@AuraEnabled
public static Id createSiteVisitFeedback(
    Id unitId,
    Id contactId,
    Id opportunityId,
    String feedback
) {
    if (unitId == null) {
        throw new AuraHandledException('Unit Id is required.');
    }

    if (contactId == null) {
        throw new AuraHandledException('Contact is required.');
    }

    if (String.isBlank(feedback)) {
        throw new AuraHandledException('Please enter feedback.');
    }

    // Fetch Unit and related Project
    Unit__c unitRecord = [
        SELECT Id, Name, Unit_Flat_Code__c, Project__c
        FROM Unit__c
        WHERE Id = :unitId
        LIMIT 1
    ];

    if (unitRecord.Project__c == null) {
        throw new AuraHandledException(
            'Project is not associated with this Unit.'
        );
    }

    // Create Site Visit Detail
    Site_Visit_Detail__c visitRecord =
        new Site_Visit_Detail__c();

    // Name is a Text field
    String recordName = 'Feedback - ' + unitRecord.Unit_Flat_Code__c;

    if (recordName.length() > 80) {
        recordName = recordName.substring(0, 80);
    }

    visitRecord.Name = recordName;

    // Relationships
    visitRecord.Contact__c = contactId;
    visitRecord.Opportunity__c = opportunityId;
    visitRecord.Project__c = unitRecord.Project__c;
    visitRecord.Unit_Flat__c = unitRecord.Id;

    // Feedback
    visitRecord.Feedback__c = feedback.trim();

    insert visitRecord;

    Opportunity opp = new opportunity();
    opp.Id = opportunityId;
    opp.StageName = 'Negotiation';
    update opp;

    return visitRecord.Id;
}

    // ============================================================
    // GET OPPORTUNITY DETAILS
    //
    // Used when URL contains:
    //
    // ?c__opportunityId=006XXXXXXXXXXXX
    //
    // Opportunity
    //      ->
    // OpportunityContactRole
    //      ->
    // Contact
    // ============================================================

    @AuraEnabled(cacheable=true)
    public static OpportunitySearchResult getOpportunityDetails(
        Id opportunityId
    ) {

        if (opportunityId == null) {
            return null;
        }

        Opportunity opp = [
            SELECT
                Id,
                Name,
                StageName,
                LeadSource,
                Property_Type__c,
                Purchase_Timeline__c,
                Purchase_Purpose__c,
                Budget_Maximum__c,
                Budget_Minimun__c,
                Customer_Requirement__c

            FROM Opportunity

            WHERE Id = :opportunityId

            LIMIT 1
        ];

        // --------------------------------------------------------
        // Get primary Opportunity Contact
        // --------------------------------------------------------

        List<OpportunityContactRole> roles = [
            SELECT
                Id,
                ContactId,
                IsPrimary,

                Contact.Id,
                Contact.Name,
                Contact.FirstName,
                Contact.LastName,
                Contact.Phone,
                Contact.Email

            FROM OpportunityContactRole

            WHERE OpportunityId = :opportunityId
            AND ContactId != NULL

            ORDER BY
                IsPrimary DESC,
                CreatedDate ASC

            LIMIT 1
        ];

        OpportunitySearchResult result =
            new OpportunitySearchResult();

        // --------------------------------------------------------
        // Opportunity information
        // --------------------------------------------------------

        result.opportunityId =
            opp.Id;

        result.opportunityName =
            opp.Name;

        result.stageName =
            opp.StageName;

        result.leadSource =
            opp.LeadSource;

        result.propertyType =
            opp.Property_Type__c;

        result.purchaseTimeline =
            opp.Purchase_Timeline__c;

        result.purchasePurpose =
            opp.Purchase_Purpose__c;

        result.budgetMinimum =
            opp.Budget_Minimun__c;

        result.budgetMaximum =
            opp.Budget_Maximum__c;

        result.customerRequirement =
            opp.Customer_Requirement__c;

        // --------------------------------------------------------
        // Contact information
        // --------------------------------------------------------

        if (!roles.isEmpty()) {

            Contact con =
                roles[0].Contact;

            if (con != null) {

                result.contactId =
                    con.Id;

                result.contactName =
                    con.Name;

                result.fullName =
                    con.Name;

                result.phone =
                    con.Phone;

                result.email =
                    con.Email;
            }
        }

        return result;
    }


    // ============================================================
    // COMMON RESULT BUILDER
    // ============================================================

    private static OpportunitySearchResult buildResult(
        Opportunity opp,
        Contact con
    ) {

        OpportunitySearchResult result =
            new OpportunitySearchResult();

        // Opportunity

        result.opportunityId =
            opp.Id;

        result.opportunityName =
            opp.Name;

        result.stageName =
            opp.StageName;

        result.leadSource =
            opp.LeadSource;

        result.propertyType =
            opp.Property_Type__c;

        result.purchaseTimeline =
            opp.Purchase_Timeline__c;

        result.purchasePurpose =
            opp.Purchase_Purpose__c;

        result.budgetMinimum =
            opp.Budget_Minimun__c;

        result.budgetMaximum =
            opp.Budget_Maximum__c;

        result.customerRequirement =
            opp.Customer_Requirement__c;

        // Contact

        if (con != null) {

            result.contactId =
                con.Id;

            result.contactName =
                con.Name;

            result.fullName =
                con.Name;

            result.phone =
                con.Phone;

            result.email =
                con.Email;
        }

        return result;
    }


    // ============================================================
    // GENERATE COST SHEET
    //
    // IMPORTANT:
    // Filename is based on:
    //
    // Project
    // Tower
    // Floor
    // Unit
    //
    // NOT Contact name.
    // ============================================================

        @AuraEnabled
        public static CostSheetResult generateCostSheet(
            Id unitId,
            Id contactId,
            Id opportunityId,
            String couponCode
        ) {

        if (unitId == null) {
            throw new AuraHandledException(
                'Unit Id is required.'
            );
        }

        if (contactId == null) {
            throw new AuraHandledException(
                'Contact Id is required.'
            );
        }

        if (opportunityId == null) {
            throw new AuraHandledException(
                'Opportunity Id is required.'
            );
        }

        // --------------------------------------------------------
        // Unit
        // --------------------------------------------------------

        Unit__c unitRecord = [
            SELECT
                Id,
                Name,

                Unit_Flat_Code__c,

                Floor__c,

                Tower__c,
                Tower__r.Name,

                Project__c,
                Project__r.Name

            FROM Unit__c

            WHERE Id = :unitId

            LIMIT 1
        ];

        // --------------------------------------------------------
        // Validate Contact
        // --------------------------------------------------------

        Contact contactRecord = [
            SELECT
                Id,
                Name,
                FirstName,
                LastName,
                Phone,
                Email

            FROM Contact

            WHERE Id = :contactId

            LIMIT 1
        ];

        // --------------------------------------------------------
        // Validate Opportunity
        // --------------------------------------------------------

        Opportunity opportunityRecord = [
            SELECT
                Id,
                Name,
                StageName

            FROM Opportunity

            WHERE Id = :opportunityId

            LIMIT 1
        ];

        // --------------------------------------------------------
        // Verify Contact belongs to Opportunity
        // --------------------------------------------------------

        List<OpportunityContactRole> contactRoles = [
            SELECT
                Id,
                OpportunityId,
                ContactId,
                IsPrimary

            FROM OpportunityContactRole

            WHERE OpportunityId = :opportunityId
            AND ContactId = :contactId

            LIMIT 1
        ];

        if (contactRoles.isEmpty()) {

            throw new AuraHandledException(
                'The selected Contact is not associated with the selected Opportunity.'
            );
        }

        // ========================================================
        // BUILD EXPECTED COST SHEET FILE NAME
        //
        // Example:
        //
        // Cost Sheet - Aarvya Enclave - Tower 1 -
        // Floor 2 - Unit (Flat) No. 1
        // ========================================================

        String projectName =
            unitRecord.Project__r != null
                ? unitRecord.Project__r.Name
                : '';

        String towerName =
            unitRecord.Tower__r != null
                ? unitRecord.Tower__r.Name
                : '';

        String floorName =
            unitRecord.Floor__c != null
                ? String.valueOf(unitRecord.Floor__c)
                : '';


         String unitName =
            String.isBlank(unitRecord.Unit_Flat_Code__c)
                ? unitRecord.Name
                : unitRecord.Unit_Flat_Code__c;

        String fileName =
            'Cost Sheet - ' + unitName + '.pdf';

        // --------------------------------------------------------
        // Generate PDF
        // --------------------------------------------------------

        PageReference pdfPage = Page.AarvyaEstates_CostSheetPDF;

        pdfPage.getParameters().put('unitId', String.valueOf(unitId));
        pdfPage.getParameters().put('opportunityId', String.valueOf(opportunityId));

        if (!String.isBlank(couponCode)) {
            CouponValidationResult couponResult =
                validateDiscountCoupon(unitId, couponCode);

            if (!couponResult.isValid) {
                throw new AuraHandledException(couponResult.message);
            }

            // Pass only the coupon code. The Visualforce controller
            // will independently validate the policy and calculate the discount.
            pdfPage.getParameters().put(
                'couponCode',
                couponResult.couponCode
            );
        }

        Blob pdfBlob;

        if (Test.isRunningTest()) {
            pdfBlob = Blob.valueOf('Test Cost Sheet PDF');
        } else {
            pdfBlob = pdfPage.getContentAsPDF();
        }

        // --------------------------------------------------------
        // ContentVersion
        // --------------------------------------------------------

        ContentVersion cv =
            new ContentVersion();

        cv.Title =
            fileName;

        cv.PathOnClient = fileName;

        cv.VersionData =
            pdfBlob;

        cv.FirstPublishLocationId =
            opportunityId;

        insert cv;

        // --------------------------------------------------------
        // Get ContentVersion information
        // --------------------------------------------------------

        cv = [
            SELECT
                Id,
                ContentDocumentId,
                Title

            FROM ContentVersion

            WHERE Id = :cv.Id

            LIMIT 1
        ];

        // --------------------------------------------------------
        // Return
        // --------------------------------------------------------

        CostSheetResult result =
            new CostSheetResult();

        result.contentVersionId =
            cv.Id;

        result.contentDocumentId =
            cv.ContentDocumentId;

        result.opportunityId =
            opportunityId;

        result.contactId =
            contactId;

        result.unitId =
            unitId;

        result.fileName = fileName ;

        return result;
    }


    // ============================================================
    // OPPORTUNITY SEARCH RESULT
    // ============================================================

    public class OpportunitySearchResult {

        @AuraEnabled
        public Id opportunityId { get; set; }

        @AuraEnabled
        public String opportunityName { get; set; }

        @AuraEnabled
        public String fullName { get; set; }

        @AuraEnabled
        public String phone { get; set; }

        @AuraEnabled
        public String email { get; set; }

        @AuraEnabled
        public String contactId { get; set; }

        @AuraEnabled
        public String contactName { get; set; }

        @AuraEnabled
        public String propertyType { get; set; }

        @AuraEnabled
        public String purchaseTimeline { get; set; }

        @AuraEnabled
        public String purchasePurpose { get; set; }

        @AuraEnabled
        public Decimal budgetMinimum { get; set; }

        @AuraEnabled
        public Decimal budgetMaximum { get; set; }

        @AuraEnabled
        public String customerRequirement { get; set; }

        @AuraEnabled
        public String leadSource { get; set; }

        @AuraEnabled
        public String stageName { get; set; }
    }


    // ============================================================
    // COST SHEET RESULT
    // ============================================================

    public class CostSheetResult {

        @AuraEnabled
        public Id contentVersionId { get; set; }

        @AuraEnabled
        public Id contentDocumentId { get; set; }

        @AuraEnabled
        public Id opportunityId { get; set; }

        @AuraEnabled
        public Id contactId { get; set; }

        @AuraEnabled
        public Id unitId { get; set; }

        @AuraEnabled
        public String fileName { get; set; }
    }

    @AuraEnabled(cacheable=true)
    public static List<OpportunitySearchResult> searchCustomers(
        String firstName,
        String lastName,
        String phone,
        String email
    ) {

        List<OpportunitySearchResult> results =
            new List<OpportunitySearchResult>();

        List<String> conditions = new List<String>();

        if (String.isNotBlank(firstName)) {
            conditions.add(
                'FirstName LIKE \'%' +
                String.escapeSingleQuotes(firstName.trim()) +
                '%\''
            );
        }

        if (String.isNotBlank(lastName)) {
            conditions.add(
                'LastName LIKE \'%' +
                String.escapeSingleQuotes(lastName.trim()) +
                '%\''
            );
        }

        if (String.isNotBlank(phone)) {
            conditions.add(
                'Phone LIKE \'%' +
                String.escapeSingleQuotes(phone.trim()) +
                '%\''
            );
        }

        if (String.isNotBlank(email)) {
            conditions.add(
                'Email LIKE \'%' +
                String.escapeSingleQuotes(email.trim()) +
                '%\''
            );
        }

        if (conditions.isEmpty()) {
            return results;
        }

        String contactQuery =
            'SELECT Id, FirstName, LastName, Name, Phone, Email ' +
            'FROM Contact ' +
            'WHERE ' + String.join(conditions, ' AND ') +
            ' ORDER BY LastName, FirstName ' +
            'LIMIT 50';

        List<Contact> contacts =
            Database.query(contactQuery);

        if (contacts.isEmpty()) {
            return results;
        }

        Set<Id> contactIds = new Set<Id>();

        for (Contact con : contacts) {
            contactIds.add(con.Id);
        }

        // --------------------------------------------------------
        // Get Opportunities through OpportunityContactRole
        // --------------------------------------------------------

        List<OpportunityContactRole> roles = [
            SELECT
                Id,
                OpportunityId,
                ContactId,
                IsPrimary,

                Opportunity.Id,
                Opportunity.Name,
                Opportunity.StageName,
                Opportunity.LeadSource,
                Opportunity.Property_Type__c,
                Opportunity.Purchase_Timeline__c,
                Opportunity.Purchase_Purpose__c,
                Opportunity.Budget_Maximum__c,
                Opportunity.Budget_Minimun__c,
                Opportunity.Customer_Requirement__c

            FROM OpportunityContactRole

            WHERE ContactId IN :contactIds
            AND OpportunityId != NULL

            ORDER BY
                IsPrimary DESC,
                CreatedDate DESC

            LIMIT 100
        ];

        if (roles.isEmpty()) {
            return results;
        }

        // --------------------------------------------------------
        // Contact map
        // --------------------------------------------------------

        Map<Id, Contact> contactMap =
            new Map<Id, Contact>(contacts);

        // --------------------------------------------------------
        // Prevent duplicate Contact results
        // --------------------------------------------------------

        Set<Id> processedContacts =
            new Set<Id>();

        for (OpportunityContactRole role : roles) {

            if (processedContacts.contains(role.ContactId)) {
                continue;
            }

            Contact con =
                contactMap.get(role.ContactId);

            if (con == null || role.Opportunity == null) {
                continue;
            }

            processedContacts.add(role.ContactId);

            results.add(
                buildResult(
                    role.Opportunity,
                    con
                )
            );
        }

        return results;
    }

}