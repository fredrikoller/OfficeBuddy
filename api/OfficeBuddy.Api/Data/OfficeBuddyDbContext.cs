using Microsoft.EntityFrameworkCore;

namespace OfficeBuddy.Api.Data;

public class OfficeBuddyDbContext(DbContextOptions<OfficeBuddyDbContext> options) : DbContext(options)
{
    public DbSet<Office> Offices => Set<Office>();
    public DbSet<ChannelOffice> ChannelOffices => Set<ChannelOffice>();
    public DbSet<Person> People => Set<Person>();
    public DbSet<WorkplaceEntry> WorkplaceEntries => Set<WorkplaceEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Office>(e =>
        {
            e.Property(o => o.Name).HasMaxLength(100);
            e.HasIndex(o => o.Name).IsUnique();
        });

        modelBuilder.Entity<ChannelOffice>(e =>
        {
            e.HasKey(c => c.ChannelId);
            e.Property(c => c.ChannelId).HasMaxLength(200);
            e.HasOne(c => c.Office).WithMany().OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Person>(e =>
        {
            e.HasKey(p => p.Oid);
            e.Property(p => p.DisplayName).HasMaxLength(200);
        });

        modelBuilder.Entity<WorkplaceEntry>(e =>
        {
            // One row per person per day.
            e.HasIndex(w => new { w.PersonOid, w.Date }).IsUnique();
            e.HasIndex(w => new { w.OfficeId, w.Date });
            e.Property(w => w.Location).HasConversion<string>().HasMaxLength(20);
            // An office with history must not be deleted by accident; deleting a person removes their entries.
            e.HasOne(w => w.Office).WithMany().OnDelete(DeleteBehavior.Restrict);
            e.HasOne(w => w.Person).WithMany().OnDelete(DeleteBehavior.Cascade);
        });
    }
}
