public class AarvyaEstates_LeadConverter {
    // Existing Aarvya Estate Account
    private static final Id AARVYA_ESTATE_ACCOUNT_ID =
        '001bm00002vXPlnAAG';
    private static final Id CONVERTED_RECORD_OWNER_ID  =
        '005bm00000XalNCAAZ';

    public class Request {
        @InvocableVariable(required=true)
        public Id leadId;
    }

    @InvocableMethod(
        label='Convert Aarvya Estate Lead'
        description='Converts a Lead using the existing Aarvya Estate Account.'
    )
    public static void convertLead(List<Request> requests) {

        Set<Id> leadIds = new Set<Id>();

        for (Request request : requests) {
            if (request.leadId != null) {
                leadIds.add(request.leadId);
            }
        }

        if (leadIds.isEmpty()) {
            return;
        }

        List<Lead> leads = [
            SELECT Id,
                   FirstName,
                   LastName,
                   Company,
                   Property_Type__c,
                   IsConverted
            FROM Lead
            WHERE Id IN :leadIds
        ];

        List<Database.LeadConvert> conversions =
            new List<Database.LeadConvert>();

        for (Lead lead : leads) {

            if (lead.IsConverted) {
                continue;
            }

            String leadName = '';

            if (String.isNotBlank(lead.FirstName)) {
                leadName += lead.FirstName + ' ';
            }

            if (String.isNotBlank(lead.LastName)) {
                leadName += lead.LastName;
            }

            // Fallback if Lead Name is unavailable
            if (String.isBlank(leadName)) {
                leadName = lead.Company;
            }

            String opportunityName = leadName.trim();

            if (String.isNotBlank(lead.Property_Type__c)) {
                opportunityName +=
                    ' - ' + lead.Property_Type__c;
            }

            opportunityName += ' - Aarvya Estate';

            Database.LeadConvert leadConvert =
                new Database.LeadConvert();

            leadConvert.setLeadId(lead.Id);

            // Use existing Aarvya Estate Account
            leadConvert.setAccountId(
                AARVYA_ESTATE_ACCOUNT_ID
            );
            
            leadConvert.setOwnerId(
                CONVERTED_RECORD_OWNER_ID
            );

            // Create Opportunity
            leadConvert.setDoNotCreateOpportunity(false);

            // Set Opportunity Name
            leadConvert.setOpportunityName(
                opportunityName
            );

            // Converted Lead Status
            leadConvert.setConvertedStatus('Converted');

            conversions.add(leadConvert);
        }

        if (!conversions.isEmpty()) {
            Database.convertLead(conversions);
        }
    }
}