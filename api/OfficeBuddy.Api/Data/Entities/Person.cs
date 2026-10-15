using System;

namespace OfficeBuddy.Api.Data.Entities;

public class Person
{
    // Entra object id (the `oid` claim).
    public Guid Oid { get; set; }
    public required string DisplayName { get; set; }
    public int? HomeOfficeId { get; set; }
    public Office? HomeOffice { get; set; }
}
