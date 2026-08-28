using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class VacancyClassifierTests
{
    [TestMethod]
    public void RussianHhVacancy_IsRussiaMarket()
    {
        var vacancy = new Vacancy { Source = "hh", Country = "Russia", Title = "Junior .NET Developer" };
        Assert.AreEqual(VacancyClassifier.MarketRussia, VacancyClassifier.Market(vacancy));
    }

    [TestMethod]
    public void Internship_IsRecognizedInRussianAndEnglish()
    {
        Assert.AreEqual(VacancyClassifier.TypeInternship,
            VacancyClassifier.OpportunityType("Стажёр C#/.NET", "Удалённая стажировка", "remote"));
        Assert.AreEqual(VacancyClassifier.TypeInternship,
            VacancyClassifier.OpportunityType("Software Engineer Intern", ".NET internship", "remote"));
    }

    [TestMethod]
    public void ContractorAndFreelance_AreSeparateTypes()
    {
        Assert.AreEqual(VacancyClassifier.TypeContractor,
            VacancyClassifier.OpportunityType(".NET Developer", "International contractor B2B", "contract"));
        Assert.AreEqual(VacancyClassifier.TypeFreelance,
            VacancyClassifier.OpportunityType("C# Developer", "Freelance project-based role", "project"));
    }
}
