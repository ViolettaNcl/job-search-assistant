using JobSearchAssistant.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobSearchAssistant.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Vacancy> Vacancies => Set<Vacancy>();
    public DbSet<Application> Applications => Set<Application>();
    public DbSet<ApplicationEvent> ApplicationEvents => Set<ApplicationEvent>();
    public DbSet<AppState> AppStates => Set<AppState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Company>()
            .HasIndex(x => new { x.Source, x.ExternalId })
            .IsUnique();

        modelBuilder.Entity<Vacancy>()
            .HasIndex(x => new { x.Source, x.ExternalId })
            .IsUnique();

        modelBuilder.Entity<Vacancy>()
            .HasIndex(x => x.CanonicalFingerprint);

        modelBuilder.Entity<Application>()
            .HasIndex(x => x.VacancyId)
            .IsUnique();

        modelBuilder.Entity<Vacancy>()
            .HasOne(x => x.Application)
            .WithOne(x => x.Vacancy)
            .HasForeignKey<Application>(x => x.VacancyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ApplicationEvent>()
            .HasOne(x => x.Vacancy)
            .WithMany(x => x.Events)
            .HasForeignKey(x => x.VacancyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AppState>().HasData(new AppState { Id = 1 });
    }
}
