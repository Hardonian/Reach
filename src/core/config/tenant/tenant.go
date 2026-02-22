// Package tenant provides tenant configuration constants.  
  
// This package centralizes tenant configuration for the OSS pivot.  
// All operations use a single default tenant model.  
package tenant  
  
// DefaultTenantID is the default tenant identifier used when no specific  
// tenant is specified. This is used for OSS deployments where multi-tenant  
// isolation is not required.  
const DefaultTenantID = "default" 
