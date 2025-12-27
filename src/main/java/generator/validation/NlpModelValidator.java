package generator.validation;

import generator.ResourceType;

import java.util.*;

/**
 * Validates NLP JSON input before EMF model creation.
 * 
 * This validator implements "fail-fast" validation: invalid inputs
 * are rejected immediately with clear error messages, preventing
 * the creation of invalid EMF models.
 * 
 * Validation checks:
 * - Missing or invalid resource types
 * - Missing mandatory attributes
 * - Illegal references (e.g., subnet without VPC)
 * - Broken metamodel constraints
 */
public class NlpModelValidator {
    
    /**
     * Validates the complete NLP JSON structure.
     * 
     * @param nlpJson The NLP output to validate
     * @throws ValidationException if validation fails
     */
    public void validate(Map<String, Object> nlpJson) {
        if (nlpJson == null) {
            throw new ValidationException("NLP JSON input cannot be null");
        }
        
        // Validate provider
        validateProvider(nlpJson);
        
        // Validate resources list
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> resources = (List<Map<String, Object>>) nlpJson.get("resources");
        if (resources == null) {
            throw new ValidationException("NLP JSON must contain a 'resources' array");
        }
        
        if (resources.isEmpty()) {
            throw new ValidationException("NLP JSON must contain at least one resource");
        }
        
        // Build resource index for reference validation
        Map<String, Map<String, Object>> resourceIndex = new HashMap<>();
        Set<String> resourceNames = new HashSet<>();
        
        // First pass: validate individual resources and build index
        for (int i = 0; i < resources.size(); i++) {
            Map<String, Object> resource = resources.get(i);
            if (resource == null) {
                throw new ValidationException(
                    String.format("Resource at index %d is null", i)
                );
            }
            
            validateResourceStructure(resource, i);
            
            String name = (String) resource.get("name");
            if (name == null || name.trim().isEmpty()) {
                throw new ValidationException(
                    String.format("Resource at index %d is missing required 'name' attribute", i)
                );
            }
            
            if (resourceNames.contains(name)) {
                throw new ValidationException(
                    String.format("Duplicate resource name: '%s' (resource names must be unique)", name)
                );
            }
            
            resourceNames.add(name);
            resourceIndex.put(name, resource);
        }
        
        // Second pass: validate references and constraints
        validateReferences(resources, resourceIndex);
        validateConstraints(resources, resourceIndex);
    }
    
    /**
     * Validates the provider field.
     */
    private void validateProvider(Map<String, Object> nlpJson) {
        Object provider = nlpJson.get("provider");
        if (provider == null) {
            // Provider is optional, defaults to AWS
            return;
        }
        
        if (!(provider instanceof String)) {
            throw new ValidationException(
                String.format("Provider must be a string, got: %s", provider.getClass().getSimpleName())
            );
        }
        
        String providerStr = (String) provider;
        if (providerStr.trim().isEmpty()) {
            throw new ValidationException("Provider cannot be an empty string");
        }
        
        // Validate provider is one of the supported values
        String providerLower = providerStr.toLowerCase();
        if (!providerLower.equals("aws") && !providerLower.equals("azure") && !providerLower.equals("gcp")) {
            throw new ValidationException(
                String.format("Unsupported provider: '%s'. Supported: AWS, Azure, GCP", providerStr)
            );
        }
    }
    
    /**
     * Validates the structure of a single resource.
     */
    private void validateResourceStructure(Map<String, Object> resource, int index) {
        // Validate type
        Object typeObj = resource.get("type");
        if (typeObj == null) {
            throw new ValidationException(
                String.format("Resource at index %d is missing required 'type' attribute", index)
            );
        }
        
        if (!(typeObj instanceof String)) {
            throw new ValidationException(
                String.format("Resource at index %d: 'type' must be a string, got: %s", 
                    index, typeObj.getClass().getSimpleName())
            );
        }
        
        String typeStr = (String) typeObj;
        if (!ResourceType.isValid(typeStr)) {
            throw new ValidationException(
                String.format("Resource at index %d: Unsupported resource type '%s'", index, typeStr),
                (String) resource.get("name"),
                typeStr
            );
        }
        
        // Validate type-specific mandatory attributes
        ResourceType type = ResourceType.fromNlpString(typeStr);
        validateResourceAttributes(resource, type, index);
    }
    
    /**
     * Validates mandatory attributes for specific resource types.
     */
    private void validateResourceAttributes(Map<String, Object> resource, ResourceType type, int index) {
        String name = (String) resource.get("name");
        
        switch (type) {
            case VPC:
                if (!resource.containsKey("cidr") || resource.get("cidr") == null) {
                    throw new ValidationException(
                        "VPC resource must have a 'cidr' attribute",
                        name,
                        "VPC"
                    );
                }
                break;
                
            case SUBNET:
                if (!resource.containsKey("cidr") || resource.get("cidr") == null) {
                    throw new ValidationException(
                        "Subnet resource must have a 'cidr' attribute",
                        name,
                        "Subnet"
                    );
                }
                if (!resource.containsKey("vpc") || resource.get("vpc") == null) {
                    throw new ValidationException(
                        "Subnet resource must reference a VPC via 'vpc' attribute",
                        name,
                        "Subnet"
                    );
                }
                break;
                
            case COMPUTE_INSTANCE:
                // Security groups are validated in constraint validation
                break;
                
            case AUTO_SCALING_GROUP:
                if (!resource.containsKey("template") || resource.get("template") == null) {
                    throw new ValidationException(
                        "AutoScalingGroup resource must reference a ComputeInstance template via 'template' attribute",
                        name,
                        "AutoScalingGroup"
                    );
                }
                break;
                
            case DATABASE_INSTANCE:
                if (!resource.containsKey("engine") || resource.get("engine") == null) {
                    throw new ValidationException(
                        "DatabaseInstance resource must have an 'engine' attribute",
                        name,
                        "DatabaseInstance"
                    );
                }
                break;
                
            case FUNCTION:
                if (!resource.containsKey("runtime") || resource.get("runtime") == null) {
                    throw new ValidationException(
                        "Function resource must have a 'runtime' attribute",
                        name,
                        "Function"
                    );
                }
                break;
                
            case CONTAINER_SERVICE:
                if (!resource.containsKey("clusterName") || resource.get("clusterName") == null) {
                    throw new ValidationException(
                        "ContainerService resource must have a 'clusterName' attribute",
                        name,
                        "ContainerService"
                    );
                }
                break;
                
            case SECRET:
                if (!resource.containsKey("key") || resource.get("key") == null) {
                    throw new ValidationException(
                        "Secret resource must have a 'key' attribute",
                        name,
                        "Secret"
                    );
                }
                break;
                
            case NETWORK_INTERFACE:
                if (!resource.containsKey("subnet") || resource.get("subnet") == null) {
                    throw new ValidationException(
                        "NetworkInterface resource must reference a Subnet via 'subnet' attribute",
                        name,
                        "NetworkInterface"
                    );
                }
                break;
        }
    }
    
    /**
     * Validates all resource references (e.g., subnet → VPC, compute → security group).
     */
    private void validateReferences(
            List<Map<String, Object>> resources,
            Map<String, Map<String, Object>> resourceIndex) {
        
        for (Map<String, Object> resource : resources) {
            String resourceName = (String) resource.get("name");
            String resourceType = (String) resource.get("type");
            
            if (resourceType == null) {
                continue; // Already validated
            }
            
            ResourceType type = ResourceType.fromNlpString(resourceType);
            
            // Validate VPC reference for Subnet
            if (type == ResourceType.SUBNET) {
                String vpcName = (String) resource.get("vpc");
                if (vpcName != null && !resourceIndex.containsKey(vpcName)) {
                    throw new ValidationException(
                        String.format("Subnet references non-existent VPC: '%s'", vpcName),
                        resourceName,
                        "Subnet"
                    );
                }
                
                if (vpcName != null) {
                    Map<String, Object> vpcResource = resourceIndex.get(vpcName);
                    String vpcType = (String) vpcResource.get("type");
                    if (vpcType == null || !ResourceType.fromNlpString(vpcType).equals(ResourceType.VPC)) {
                        throw new ValidationException(
                            String.format("Subnet references resource '%s' which is not a VPC (type: %s)", 
                                vpcName, vpcType),
                            resourceName,
                            "Subnet"
                        );
                    }
                }
            }
            
            // Validate SecurityGroup references for ComputeInstance
            if (type == ResourceType.COMPUTE_INSTANCE) {
                @SuppressWarnings("unchecked")
                List<String> sgNames = (List<String>) resource.get("securityGroups");
                if (sgNames != null) {
                    for (String sgName : sgNames) {
                        if (!resourceIndex.containsKey(sgName)) {
                            throw new ValidationException(
                                String.format("ComputeInstance references non-existent SecurityGroup: '%s'", sgName),
                                resourceName,
                                "ComputeInstance"
                            );
                        }
                        
                        Map<String, Object> sgResource = resourceIndex.get(sgName);
                        String sgType = (String) sgResource.get("type");
                        if (sgType == null || !ResourceType.fromNlpString(sgType).equals(ResourceType.SECURITY_GROUP)) {
                            throw new ValidationException(
                                String.format("ComputeInstance references resource '%s' which is not a SecurityGroup (type: %s)", 
                                    sgName, sgType),
                                resourceName,
                                "ComputeInstance"
                            );
                        }
                    }
                }
            }
            
            // Validate template reference for AutoScalingGroup
            if (type == ResourceType.AUTO_SCALING_GROUP) {
                String templateName = (String) resource.get("template");
                if (templateName != null && !resourceIndex.containsKey(templateName)) {
                    throw new ValidationException(
                        String.format("AutoScalingGroup references non-existent ComputeInstance template: '%s'", templateName),
                        resourceName,
                        "AutoScalingGroup"
                    );
                }
                
                if (templateName != null) {
                    Map<String, Object> templateResource = resourceIndex.get(templateName);
                    String templateType = (String) templateResource.get("type");
                    if (templateType == null || !ResourceType.fromNlpString(templateType).equals(ResourceType.COMPUTE_INSTANCE)) {
                        throw new ValidationException(
                            String.format("AutoScalingGroup references resource '%s' which is not a ComputeInstance (type: %s)", 
                                templateName, templateType),
                            resourceName,
                            "AutoScalingGroup"
                        );
                    }
                }
            }
            
            // Validate subnet reference for NetworkInterface
            if (type == ResourceType.NETWORK_INTERFACE) {
                String subnetName = (String) resource.get("subnet");
                if (subnetName != null && !resourceIndex.containsKey(subnetName)) {
                    throw new ValidationException(
                        String.format("NetworkInterface references non-existent Subnet: '%s'", subnetName),
                        resourceName,
                        "NetworkInterface"
                    );
                }
            }
        }
    }
    
    /**
     * Validates metamodel constraints.
     */
    private void validateConstraints(
            List<Map<String, Object>> resources,
            Map<String, Map<String, Object>> resourceIndex) {
        
        for (Map<String, Object> resource : resources) {
            String resourceName = (String) resource.get("name");
            String resourceType = (String) resource.get("type");
            
            if (resourceType == null) {
                continue;
            }
            
            ResourceType type = ResourceType.fromNlpString(resourceType);
            
            // Constraint: Subnet must belong to exactly one VPC
            if (type == ResourceType.SUBNET) {
                String vpcName = (String) resource.get("vpc");
                if (vpcName == null || vpcName.trim().isEmpty()) {
                    throw new ValidationException(
                        "Subnet must belong to exactly one VPC (missing 'vpc' reference)",
                        resourceName,
                        "Subnet"
                    );
                }
            }
            
            // Constraint: ComputeInstance must reference at least one SecurityGroup
            if (type == ResourceType.COMPUTE_INSTANCE) {
                @SuppressWarnings("unchecked")
                List<String> sgNames = (List<String>) resource.get("securityGroups");
                if (sgNames == null || sgNames.isEmpty()) {
                    throw new ValidationException(
                        "ComputeInstance must reference at least one SecurityGroup",
                        resourceName,
                        "ComputeInstance"
                    );
                }
            }
            
            // Constraint: AutoScalingGroup must reference a ComputeInstance template
            if (type == ResourceType.AUTO_SCALING_GROUP) {
                String templateName = (String) resource.get("template");
                if (templateName == null || templateName.trim().isEmpty()) {
                    throw new ValidationException(
                        "AutoScalingGroup must reference a ComputeInstance template",
                        resourceName,
                        "AutoScalingGroup"
                    );
                }
            }
        }
    }
}


