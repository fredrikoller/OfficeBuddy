using System;

namespace OfficeBuddy.Api.Data;

public class Office
{
    public int Id { get; set; }
    public required string Name { get; set; }
}

public class ChannelOffice
{
    public const int ChannelIdMaxLength = 200;

    public required string ChannelId { get; set; }
    public int OfficeId { get; set; }
    public Office Office { get; set; } = null!;
}

public class Person
{
    // Entra object id (the `oid` claim).
    public Guid Oid { get; set; }
    public required string DisplayName { get; set; }
    public int? HomeOfficeId { get; set; }
    public Office? HomeOffice { get; set; }
}

public enum Location
{
    Office,
    Home,
    Customer,
}

public class WorkplaceEntry
{
    public int Id { get; set; }
    public Guid PersonOid { get; set; }
    public Person Person { get; set; } = null!;
    public DateOnly Date { get; set; }
    public Location Location { get; set; }
    public int OfficeId { get; set; }
    public Office Office { get; set; } = null!;
}
