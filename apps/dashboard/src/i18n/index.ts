import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      nav: {
        projects: "Projects"
      },
      common: {
        message: "Message",
        source: "Source",
        url: "URL",
        created: "Created",
        count: "Count",
        users: "Users",
        usersAffected: "Users Affected",
        firstSeen: "First Seen",
        lastSeen: "Last Seen",
        noStack: "No stack trace"
      },
      projects: {
        title: "Projects",
        name: "Name",
        totalErrors: "Total Errors",
        errorsToday: "Errors Today"
      },
      issues: {
        title: "Issues",
        detail: "Issue Detail",
        latestEvents: "Latest Events",
        viewRawEvents: "View Raw Events",
        workflow: "Issue Workflow",
        workflowHint: "Track ownership and move the issue through resolution.",
        status: "Status",
        priority: "Priority",
        assignee: "Assignee",
        assigneePlaceholder: "Developer name",
        save: "Save",
        saving: "Saving...",
        statuses: {
          OPEN: "Open",
          IN_PROGRESS: "In Progress",
          RESOLVED: "Resolved",
          IGNORED: "Ignored"
        },
        priorities: {
          LOW: "Low",
          MEDIUM: "Medium",
          HIGH: "High",
          HIGHEST: "Highest"
        }
      },
      events: {
        title: "Events",
        detail: "Event Detail",
        userAgent: "User Agent",
        stack: "Stack"
      }
    }
  },
  hy: {
    translation: {
      nav: {
        projects: "Նախագծեր"
      },
      common: {
        message: "Հաղորդագրություն",
        source: "Աղբյուր",
        url: "URL",
        created: "Ստեղծվել է",
        count: "Քանակ",
        users: "Օգտատերեր",
        usersAffected: "Օգտատերեր",
        firstSeen: "Առաջին անգամ",
        lastSeen: "Վերջին անգամ",
        noStack: "Stack trace չկա"
      },
      projects: {
        title: "Նախագծեր",
        name: "Անուն",
        totalErrors: "Ընդհանուր սխալներ",
        errorsToday: "Այսօրվա սխալներ"
      },
      issues: {
        title: "Խնդիրներ",
        detail: "Խնդրի մանրամասներ",
        latestEvents: "Վերջին իրադարձություններ",
        viewRawEvents: "Դիտել հում իրադարձությունները",
        workflow: "Խնդրի ընթացք",
        workflowHint: "Նշեք պատասխանատուին և փոխեք խնդրի կարգավիճակը։",
        status: "Կարգավիճակ",
        priority: "Առաջնահերթություն",
        assignee: "Պատասխանատու",
        assigneePlaceholder: "Մշակողի անունը",
        save: "Պահպանել",
        saving: "Պահպանվում է...",
        statuses: {
          OPEN: "Բաց",
          IN_PROGRESS: "Ընթացքի մեջ",
          RESOLVED: "Լուծված",
          IGNORED: "Անտեսված"
        },
        priorities: {
          LOW: "Ցածր",
          MEDIUM: "Միջին",
          HIGH: "Բարձր",
          HIGHEST: "Ամենաբարձր"
        }
      },
      events: {
        title: "Իրադարձություններ",
        detail: "Իրադարձության մանրամասներ",
        userAgent: "User Agent",
        stack: "Stack"
      }
    }
  }
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem("artstrace_lang") ?? "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
