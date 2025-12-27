package generator;

import java.util.HashMap;
import java.util.Map;

/**
 * Strongly-typed enumeration of all supported cloud resource types.
 * 
 * This enum ensures compile-time safety and eliminates string-based
 * type handling bugs. NLP strings are normalized to enum values.
 */
public enum ResourceType {
    // Compute resources
    COMPUTE_INSTANCE("ComputeInstance"),
    AUTO_SCALING_GROUP("AutoScalingGroup"),
    CONTAINER_SERVICE("ContainerService"),
    FUNCTION("Function"),
    
    // Storage resources
    VOLUME("Volume"),
    STORAGE_BUCKET("StorageBucket"),
    FILE_SYSTEM("FileSystem"),
    
    // Database resources
    DATABASE_INSTANCE("DatabaseInstance"),
    NOSQL_DATABASE("NoSQLDatabase"),
    
    // Network resources
    VPC("VPC"),
    SUBNET("Subnet"),
    ROUTE_TABLE("RouteTable"),
    SECURITY_GROUP("SecurityGroup"),
    LOAD_BALANCER("LoadBalancer"),
    NETWORK_INTERFACE("NetworkInterface"),
    
    // Security resources
    IAM_ROLE("IAMRole"),
    IAM_POLICY("IAMPolicy"),
    SECRET("Secret"),
    
    // Monitoring resources
    MONITORING_SERVICE("MonitoringService");
    
    private final String nlpName;
    private static final Map<String, ResourceType> NLP_NAME_MAP = new HashMap<>();
    
    static {
        for (ResourceType type : values()) {
            NLP_NAME_MAP.put(type.nlpName, type);
            // Also support case-insensitive matching
            NLP_NAME_MAP.put(type.nlpName.toLowerCase(), type);
        }
    }
    
    ResourceType(String nlpName) {
        this.nlpName = nlpName;
    }
    
    /**
     * Normalizes an NLP string to a ResourceType enum value.
     * 
     * @param nlpString The resource type string from NLP output
     * @return The corresponding ResourceType enum
     * @throws IllegalArgumentException if the string is not a valid resource type
     */
    public static ResourceType fromNlpString(String nlpString) {
        if (nlpString == null || nlpString.trim().isEmpty()) {
            throw new IllegalArgumentException("Resource type cannot be null or empty");
        }
        
        ResourceType type = NLP_NAME_MAP.get(nlpString);
        if (type == null) {
            type = NLP_NAME_MAP.get(nlpString.toLowerCase());
        }
        
        if (type == null) {
            throw new IllegalArgumentException(
                String.format("Unsupported resource type: '%s'. Supported types: %s", 
                    nlpString, 
                    String.join(", ", NLP_NAME_MAP.keySet()))
            );
        }
        
        return type;
    }
    
    /**
     * Returns the canonical NLP name for this resource type.
     */
    public String getNlpName() {
        return nlpName;
    }
    
    /**
     * Checks if a string represents a valid resource type.
     */
    public static boolean isValid(String nlpString) {
        if (nlpString == null || nlpString.trim().isEmpty()) {
            return false;
        }
        return NLP_NAME_MAP.containsKey(nlpString) || 
               NLP_NAME_MAP.containsKey(nlpString.toLowerCase());
    }
}


