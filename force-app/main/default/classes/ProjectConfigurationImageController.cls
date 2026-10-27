public with sharing class ProjectConfigurationImageController {

    public class ImageWrapper {
        @AuraEnabled public Id contentDocumentId;
        @AuraEnabled public Id contentVersionId;
        @AuraEnabled public String title;
        @AuraEnabled public String fileType;
        @AuraEnabled public String imageUrl;
        @AuraEnabled public Id configurationId;
        @AuraEnabled public String configurationName;
        @AuraEnabled public Decimal sqFt;
        @AuraEnabled public Decimal balconies;

        public ImageWrapper(
            Id contentDocumentId,
            Id contentVersionId,
            String title,
            String fileType,
            Id configurationId,
            String configurationName,
            Decimal sqFt,
            Decimal balconies
        ) {
            this.contentDocumentId = contentDocumentId;
            this.contentVersionId = contentVersionId;
            this.title = title;
            this.fileType = fileType;
            this.configurationId = configurationId;
            this.configurationName = configurationName;
            this.sqFt = sqFt;
            this.balconies = balconies;

            this.imageUrl =
                '/sfc/servlet.shepherd/version/download/' +
                contentVersionId;
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<ImageWrapper> getProjectConfigurationImages(Id unitId) {

        if (unitId == null) {
            throw new AuraHandledException('Unit Id is required.');
        }

        // ---------------------------------------------------------
        // 1. Get Project from Unit
        // ---------------------------------------------------------
        Unit__c unitRecord = [
            SELECT Id, Project__c
            FROM Unit__c
            WHERE Id = :unitId
            LIMIT 1
        ];

        if (unitRecord.Project__c == null) {
            return new List<ImageWrapper>();
        }

        // ---------------------------------------------------------
        // 2. Get Project Configurations
        // ---------------------------------------------------------
        List<Project_Configuration__c> configurations = [
            SELECT
                Id,
                Name,
                Sq_Ft__c,
                Balconies__c
            FROM Project_Configuration__c
            WHERE Project__c = :unitRecord.Project__c
            ORDER BY Name
        ];

        if (configurations.isEmpty()) {
            return new List<ImageWrapper>();
        }

        Set<Id> configurationIds = new Set<Id>();

        Map<Id, Project_Configuration__c> configurationMap =
            new Map<Id, Project_Configuration__c>();

        for (Project_Configuration__c config : configurations) {
            configurationIds.add(config.Id);
            configurationMap.put(config.Id, config);
        }

        // ---------------------------------------------------------
        // 3. Get Salesforce Files attached to configurations
        // ---------------------------------------------------------
        List<ContentDocumentLink> links = [
            SELECT
                ContentDocumentId,
                LinkedEntityId
            FROM ContentDocumentLink
            WHERE LinkedEntityId IN :configurationIds
        ];

        if (links.isEmpty()) {
            return new List<ImageWrapper>();
        }

        Set<Id> documentIds = new Set<Id>();

        Map<Id, Id> documentToConfiguration =
            new Map<Id, Id>();

        for (ContentDocumentLink link : links) {

            documentIds.add(link.ContentDocumentId);

            documentToConfiguration.put(
                link.ContentDocumentId,
                link.LinkedEntityId
            );
        }

        // ---------------------------------------------------------
        // 4. Get latest versions of files
        // ---------------------------------------------------------
        List<ContentVersion> versions = [
            SELECT
                Id,
                ContentDocumentId,
                Title,
                FileType,
                IsLatest
            FROM ContentVersion
            WHERE ContentDocumentId IN :documentIds
            AND IsLatest = true
            AND FileType IN (
                'JPG',
                'JPEG',
                'PNG',
                'GIF',
                'WEBP'
            )
            ORDER BY CreatedDate ASC
        ];

        // ---------------------------------------------------------
        // 5. Prepare response
        // ---------------------------------------------------------
        List<ImageWrapper> result = new List<ImageWrapper>();

        for (ContentVersion version : versions) {

            Id configurationId =
                documentToConfiguration.get(
                    version.ContentDocumentId
                );

            Project_Configuration__c config =
                configurationMap.get(configurationId);

            if (config == null) {
                continue;
            }

            result.add(
                new ImageWrapper(
                    version.ContentDocumentId,
                    version.Id,
                    version.Title,
                    version.FileType,
                    config.Id,
                    config.Name,
                    config.Sq_Ft__c,
                    config.Balconies__c
                )
            );
        }

        return result;
    }
}