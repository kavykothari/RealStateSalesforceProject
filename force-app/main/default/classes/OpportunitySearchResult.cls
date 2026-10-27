public class OpportunitySearchResult {

    @AuraEnabled public Id opportunityId { get; set; }
    @AuraEnabled public String opportunityName { get; set; }
    @AuraEnabled public String fullName { get; set; }

    @AuraEnabled public String phone { get; set; }
    @AuraEnabled public String email { get; set; }

    @AuraEnabled public String contactId { get; set; }
    @AuraEnabled public String contactName { get; set; }

    @AuraEnabled public String propertyType { get; set; }
    @AuraEnabled public String purchaseTimeline { get; set; }
    @AuraEnabled public String purchasePurpose { get; set; }

    @AuraEnabled public Decimal budgetMinimum { get; set; }
    @AuraEnabled public Decimal budgetMaximum { get; set; }

    @AuraEnabled public String customerRequirement { get; set; }
    @AuraEnabled public String leadSource { get; set; }

    @AuraEnabled public String stageName { get; set; }
}