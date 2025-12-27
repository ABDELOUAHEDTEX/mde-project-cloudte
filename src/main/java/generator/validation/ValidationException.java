package generator.validation;

/**
 * Base exception for all validation errors in the NLP → Model transformation.
 * 
 * This exception provides clear, actionable error messages that help
 * identify the exact problem in the NLP input.
 */
public class ValidationException extends RuntimeException {
    
    private final String resourceName;
    private final String resourceType;
    
    public ValidationException(String message) {
        super(message);
        this.resourceName = null;
        this.resourceType = null;
    }
    
    public ValidationException(String message, String resourceName, String resourceType) {
        super(formatMessage(message, resourceName, resourceType));
        this.resourceName = resourceName;
        this.resourceType = resourceType;
    }
    
    public ValidationException(String message, Throwable cause) {
        super(message, cause);
        this.resourceName = null;
        this.resourceType = null;
    }
    
    private static String formatMessage(String message, String resourceName, String resourceType) {
        if (resourceName != null && resourceType != null) {
            return String.format("[%s '%s'] %s", resourceType, resourceName, message);
        }
        return message;
    }
    
    public String getResourceName() {
        return resourceName;
    }
    
    public String getResourceType() {
        return resourceType;
    }
}


