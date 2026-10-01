using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OfficeBuddy.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Offices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Offices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChannelOffices",
                columns: table => new
                {
                    ChannelId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    OfficeId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelOffices", x => x.ChannelId);
                    table.ForeignKey(
                        name: "FK_ChannelOffices_Offices_OfficeId",
                        column: x => x.OfficeId,
                        principalTable: "Offices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "People",
                columns: table => new
                {
                    Oid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    HomeOfficeId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_People", x => x.Oid);
                    table.ForeignKey(
                        name: "FK_People_Offices_HomeOfficeId",
                        column: x => x.HomeOfficeId,
                        principalTable: "Offices",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "WorkplaceEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PersonOid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Location = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OfficeId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkplaceEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkplaceEntries_Offices_OfficeId",
                        column: x => x.OfficeId,
                        principalTable: "Offices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkplaceEntries_People_PersonOid",
                        column: x => x.PersonOid,
                        principalTable: "People",
                        principalColumn: "Oid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChannelOffices_OfficeId",
                table: "ChannelOffices",
                column: "OfficeId");

            migrationBuilder.CreateIndex(
                name: "IX_Offices_Name",
                table: "Offices",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_People_HomeOfficeId",
                table: "People",
                column: "HomeOfficeId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkplaceEntries_OfficeId_Date",
                table: "WorkplaceEntries",
                columns: new[] { "OfficeId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkplaceEntries_PersonOid_Date",
                table: "WorkplaceEntries",
                columns: new[] { "PersonOid", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChannelOffices");

            migrationBuilder.DropTable(
                name: "WorkplaceEntries");

            migrationBuilder.DropTable(
                name: "People");

            migrationBuilder.DropTable(
                name: "Offices");
        }
    }
}
