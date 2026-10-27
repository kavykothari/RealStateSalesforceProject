public with sharing class ProjectTowerController {

    // =========================================================
    // PROJECT DROPDOWN OPTION
    // =========================================================

    public class ProjectOption {

        @AuraEnabled
        public Id id;

        @AuraEnabled
        public String name;

        @AuraEnabled
        public String projectCode;


        public ProjectOption(Project__c projectRecord) {

            this.id = projectRecord.Id;
            this.name = projectRecord.Name;
            this.projectCode = projectRecord.Project_Code__c;

        }
    }


    // =========================================================
    // GET PROJECTS
    // =========================================================

    @AuraEnabled(cacheable=true)
    public static List<ProjectOption> getProjects() {

        List<Project__c> projects = [
            SELECT
                Id,
                Name,
                Project_Code__c
            FROM Project__c
            ORDER BY Name
        ];


        List<ProjectOption> options = new List<ProjectOption>();


        for (Project__c projectRecord : projects) {

            options.add(
                new ProjectOption(projectRecord)
            );

        }


        return options;
    }


    // =========================================================
    // GET PROJECT DETAILS
    // =========================================================

    @AuraEnabled(cacheable=true)
    public static Project__c getProjectDetails(
        Id projectId
    ) {

        if (projectId == null) {
            return null;
        }


        return [
            SELECT
                Id,
                Name,
                Project_Code__c,
                Rate_per_Sq_Ft__c,
                No_of_Towers__c,
                Project_Website__c,
                Project_Image_Description__c,
                Amenities__c,
                Location__Street__s,
                Location__City__s,
                Location__StateCode__s,
                Location__PostalCode__s,
                Location__CountryCode__s,
                Project_Type__c,
                Project_Status__c,
                RERA_Registered__c,
                RERA_Registration_Number__c,
                RERA_Registration_Date__c,
                RERA_Expiry_Date__c,
                Announcement_Date__c,
                Launch_Date__c,
                Construction_Start_Date__c,
                Expected_Completion_Date__c,
                Total_Towers__c
            FROM Project__c
            WHERE Id = :projectId
            LIMIT 1
        ];
    }


    // =========================================================
    // GET TOWERS
    // =========================================================

    @AuraEnabled(cacheable=true)
    public static List<Tower__c> getTowers(
        Id projectId
    ) {

        if (projectId == null) {

            return new List<Tower__c>();

        }


        return [
            SELECT
                Id,
                Name,
                Total_Floors__c,
                No_of_Flats_per_Floor__c,
                Planned_Possession_Date__c,
                Construction_Status__c,
                Project__c,
                Total_Flats__c,
                Tower_Code__c
            FROM Tower__c
            WHERE Project__c = :projectId
            ORDER BY Name
        ];
    }
}